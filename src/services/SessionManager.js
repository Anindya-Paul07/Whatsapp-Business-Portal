const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');
const db = require('../config/db');

/**
 * SessionManager
 * ─────────────────────────────────────────────────────────────
 * Central registry for all active whatsapp-web.js Client
 * instances.  Each user gets exactly one isolated Puppeteer
 * browser; sessions are persisted via LocalAuth so the QR code
 * only needs to be scanned once.
 *
 * Memory management:
 *   - Clients are lazy-initialised (only when the user hits
 *     /sessions/init).
 *   - destroySession() terminates the browser process and
 *     removes the entry from the Map so GC can collect it.
 *   - The Puppeteer args keep memory footprint small:
 *     --no-sandbox, --disable-dev-shm-usage, --single-process.
 */
class SessionManager {
    constructor(io) {
        /** @type {Map<number, Client>} userId → Client */
        this.sessions = new Map();
        this.io = io; // socket.io server instance
    }

    /**
     * Return an existing client or create + initialise a new one.
     * @param {number} userId
     * @returns {Client}
     */
    getOrCreateSession(userId) {
        if (this.sessions.has(userId)) {
            return this.sessions.get(userId);
        }

        const sessionPath = path.resolve(
            process.env.SESSION_DATA_PATH || './sessions'
        );

        const client = new Client({
            authStrategy: new LocalAuth({
                clientId: `user_${userId}`,
                dataPath: sessionPath,
            }),
            puppeteer: {
                headless: 'shell', // More stable for automation
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--disable-gpu',
                    '--disable-extensions',
                ],
            },
        });

        this._attachEventListeners(client, userId);
        client.initialize();

        this.sessions.set(userId, client);
        console.log(`[SessionManager] Session initialised for user ${userId}`);
        return client;
    }

    /**
     * Destroy a session: disconnect WhatsApp, kill Puppeteer, free memory.
     * @param {number} userId
     */
    async destroySession(userId) {
        const client = this.sessions.get(userId);
        if (!client) return;

        try {
            await client.destroy();
        } catch (_) { /* already gone */ }

        this.sessions.delete(userId);
        console.log(`[SessionManager] Session destroyed for user ${userId}`);
    }

    /**
     * Returns true if the user has an active, ready session.
     * @param {number} userId
     * @returns {boolean}
     */
    isReady(userId) {
        const client = this.sessions.get(userId);
        return !!(client && client.info);
    }

    // ─────────────────────────────────────────────────────────────
    //  Private helpers
    // ─────────────────────────────────────────────────────────────

    _attachEventListeners(client, userId) {
        const room = `user_${userId}`;

        // QR code → emit to user's private Socket.IO room
        client.on('qr', (qr) => {
            console.log(`[SessionManager] QR generated for user ${userId}`);
            this.io.to(room).emit('qr_code', { qr });
        });

        client.on('ready', () => {
            console.log(`Client ${userId} is ready!`);
            // CRITICAL: Notify frontend to hide QR and show 'Connected'
            this.io.to(room).emit('session_status', {
                status: 'ready',
                message: 'WhatsApp is connected'
            });
        });

        client.on('authenticated', () => {
            console.log(`[SessionManager] Authenticated for user ${userId}`);
            this.io.to(room).emit('session_authenticated', { userId });
        });

        client.on('auth_failure', (msg) => {
            console.error(`[SessionManager] Auth failure for user ${userId}:`, msg);
            this.io.to(room).emit('session_error', { error: msg });
            this.sessions.delete(userId);
        });

        client.on('disconnected', (reason) => {
            console.warn(`[SessionManager] Disconnected user ${userId}:`, reason);
            this.io.to(room).emit('session_status', {
                status: 'disconnected',
                message: 'WhatsApp logged out'
            });
            this.sessions.delete(userId);
        });

        // ── Inbound message handler ─────────────────────────────────
        client.on('message', async (msg) => {
            await this._handleInboundMessage(msg, userId, room);
        });
    }

    /**
     * Global inbound-message handler:
     *  1. Log to DB
     *  2. Check template_bots and auto-reply if matched
     *  3. Emit 'message_received' to the user's Socket.IO room
     */
    async _handleInboundMessage(msg, userId, room) {
        const contact = await msg.getContact();
        const contactPhone = contact.number || msg.from.replace('@c.us', '');
        const body = msg.body;

        // 1 – Save incoming message to chat_logs
        try {
            await db.query(
                `INSERT INTO chat_logs (user_id, contact_phone, body, direction)
         VALUES (?, ?, ?, 'in')`,
                [userId, contactPhone, body]
            );
        } catch (err) {
            console.error('[SessionManager] DB log error (inbound):', err.message);
        }

        // 2 – Emit real-time event to the user's chat tab
        this.io.to(room).emit('message_received', {
            contactPhone,
            body,
            direction: 'in',
            timestamp: new Date().toISOString(),
        });

        // 3 – Check message_bots for auto-reply
        try {
            const [bots] = await db.query(
                `SELECT * FROM message_bots
          WHERE user_id = ? AND is_active = 1`,
                [userId]
            );

            for (const bot of bots) {
                let matched = false;
                const keyword = bot.keyword.toLowerCase();
                const msgBodyLow = body.toLowerCase().trim();

                if (bot.reply_type === 'exact') {
                    matched = msgBodyLow === keyword;
                } else { // 'contains'
                    matched = msgBodyLow.includes(keyword);
                }

                if (matched) {
                    await msg.reply(bot.reply_text);

                    // Log the auto-reply
                    await db.query(
                        `INSERT INTO chat_logs (user_id, contact_phone, body, direction)
             VALUES (?, ?, ?, 'out')`,
                        [userId, contactPhone, bot.reply_text]
                    );

                    // Emit the outbound auto-reply to the chat tab as well
                    this.io.to(room).emit('message_received', {
                        contactPhone,
                        body: bot.reply_text,
                        direction: 'out',
                        timestamp: new Date().toISOString(),
                    });

                    break; // only first matching bot fires
                }
            }
        } catch (err) {
            console.error('[SessionManager] Template bot error:', err.message);
        }
    }
}

module.exports = SessionManager;
