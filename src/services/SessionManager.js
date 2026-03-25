const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');
const db = require('../config/db');

/**
 * SessionManager
 * ─────────────────────────────────────────────────────────────
 * Pool management for multiple WhatsApp sessions per user.
 * Each session gets its own isolated Puppeteer browser.
 */
class SessionManager {
    constructor(io) {
        /** @type {Map<string, Client>} compositeKey (userId_sessionId) → Client */
        this.clients = new Map();
        this.io = io;
    }

    /**
     * Get or create a client for a specific session ID.
     */
    async getClient(userId, sessionId) {
        const key = `${userId}_${sessionId}`;
        if (this.clients.has(key)) return this.clients.get(key);

        const sessionPath = path.resolve(process.env.SESSION_DATA_PATH || './sessions');
        const client = new Client({
            authStrategy: new LocalAuth({
                clientId: `session_${sessionId}`,
                dataPath: sessionPath,
            }),
            puppeteer: {
                headless: 'shell',
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            },
        });

        this._attachEventListeners(client, userId, sessionId);
        client.initialize();
        this.clients.set(key, client);
        return client;
    }

    /**
     * Initialize all 'active' sessions for all users on startup.
     */
    async initAllActive() {
        try {
            const [sessions] = await db.query("SELECT * FROM whatsapp_sessions WHERE status = 'active'");
            for (const s of sessions) {
                await this.getClient(s.user_id, s.id);
            }
        } catch (err) {
            console.error('[SessionManager] Init Error:', err.message);
        }
    }

    isReady(userId, sessionId) {
        const key = `${userId}_${sessionId}`;
        const client = this.clients.get(key);
        return !!(client && client.info);
    }

    // (EventListeners would be updated to emit session-specific status to the user room)
    _attachEventListeners(client, userId, sessionId) {
        const room = `user_${userId}`;
        client.on('qr', (qr) => this.io.to(room).emit('qr_code', { qr, sessionId }));
        client.on('ready', () => {
            db.query("UPDATE whatsapp_sessions SET status = 'active' WHERE id = ?", [sessionId]);
            this.io.to(room).emit('session_status', { status: 'ready', sessionId });
        });
        // ... (auth_failure, disconnected, etc. follow same logic)
    }
}

module.exports = SessionManager;
