/**
 * server.js
 * ─────────────────────────────────────────────────────────────
 * Entry point for the WhatsApp Marketing Platform backend.
 *
 * Architecture:
 *   Express  + Socket.IO (both share the same http.Server)
 *   Routes   → auth / sessions / contacts / campaigns / bots / chats
 *   Services → SessionManager (whatsapp-web.js) | CampaignRunner
 *   DB       → MySQL via mysql2/promise connection pool
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// ── Ensure required directories exist ─────────────────────────
const SESSION_PATH = path.resolve(process.env.SESSION_DATA_PATH || './sessions');
const UPLOAD_PATH = path.resolve('./uploads');
[SESSION_PATH, UPLOAD_PATH].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ── Express & HTTP server ──────────────────────────────────────
const app = express();
const server = http.createServer(app);

// ── Socket.IO ─────────────────────────────────────────────────
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

// ── SessionManager (requires io) ──────────────────────────────
const SessionManager = require('./src/services/SessionManager');
const sessionManager = new SessionManager(io);

// ── Start Background Services ─────────────────────────────────
const SchedulerService = require('./src/services/SchedulerService');
const schedulerService = new SchedulerService(sessionManager, io);
schedulerService.start();

const WarmupService = require('./src/services/WarmupService');
const warmupService = new WarmupService(sessionManager);
warmupService.start();

// ── Global middleware ──────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Health check ───────────────────────────────────────────────
app.get('/health', (_req, res) =>
    res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() })
);

// ── Routes ────────────────────────────────────────────────────
const authRoutes = require('./src/routes/auth');
const sessionRoutes = require('./src/routes/sessions')(sessionManager);
const contactRoutes = require('./src/routes/contacts');
const campaignRoutes = require('./src/routes/campaigns')(sessionManager, io);
const messageBotRoutes = require('./src/routes/message-bots');
const templateRoutes = require('./src/routes/templates');
const chatRoutes = require('./src/routes/chats')(sessionManager);

app.use('/auth', authRoutes);
app.use('/sessions', sessionRoutes);
app.use('/contacts', contactRoutes);
app.use('/campaigns', campaignRoutes);
app.use('/message-bots', messageBotRoutes);
app.use('/templates', templateRoutes);
app.use('/chats', chatRoutes);

// ── 404 handler ───────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Global error handler ───────────────────────────────────────
app.use((err, _req, res, _next) => {
    console.error('[Server] Unhandled error:', err.message);
    res.status(500).json({ success: false, message: err.message || 'Internal server error' });
});

// ── Socket.IO: join private user rooms ────────────────────────
const jwt = require('jsonwebtoken');

io.use((socket, next) => {
    // Clients must pass { auth: { token: 'Bearer ...' } } when connecting
    const raw = socket.handshake.auth?.token || socket.handshake.query?.token || '';
    const token = raw.replace(/^Bearer\s+/i, '');

    if (!token) return next(new Error('Authentication required'));

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this');
        socket.userId = decoded.id;
        next();
    } catch (err) {
        next(new Error('Invalid token'));
    }
});

io.on('connection', (socket) => {
    const userId = socket.userId;
    const room = `user_${userId}`;

    // Each user joins their private room
    socket.join(room);
    console.log(`[Socket.IO] User ${userId} connected (socket ${socket.id}), joined room ${room}`);

    socket.on('disconnect', (reason) => {
        console.log(`[Socket.IO] User ${userId} disconnected: ${reason}`);
    });
});

// ── Memory management: graceful shutdown ──────────────────────
async function shutdown(signal) {
    console.log(`\n[Server] ${signal} received — shutting down gracefully…`);

    const destroyPromises = [];
    for (const [userId] of sessionManager.clients) {
        destroyPromises.push(sessionManager.clients.get(userId).destroy());
    }
    await Promise.allSettled(destroyPromises);

    server.close(() => {
        console.log('[Server] HTTP server closed. Bye!');
        process.exit(0);
    });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ── Start ──────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000', 10);
server.listen(PORT, () => {
    console.log(`\n🚀 WhatsApp Marketing Platform running on port ${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   Env:    ${process.env.NODE_ENV || 'development'}\n`);
});
