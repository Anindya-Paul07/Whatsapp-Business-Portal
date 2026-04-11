const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');

const OPT_OUT_WORDS = new Set(['stop', 'unsubscribe', 'cancel', 'optout', 'opt out', 'remove', 'quit']);

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
     * Get or create a client for a specific user ID.
     */
    getOrCreateSession(userId, sessionId = 'default') {
        const key = userId;
        if (this.clients.has(key)) return this.clients.get(key);

        const sessionPath = path.resolve(process.env.SESSION_DATA_PATH || './sessions');
        const client = new Client({
            authStrategy: new LocalAuth({
                clientId: `session_${key}`,
                dataPath: sessionPath,
            }),
            // Disable remote version cache to prevent ETIMEDOUT network errors
            webVersionCache: {
                type: 'none',
            },
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--disable-extensions',
                    '--disable-background-networking',
                    '--disable-default-apps',
                    '--disable-sync',
                    '--disable-translate',
                    '--hide-scrollbars',
                    '--metrics-recording-only',
                    '--mute-audio',
                    '--safebrowsing-disable-auto-update',
                ],
            },
        });

        this._attachEventListeners(client, userId, sessionId);
        this.clients.set(key, client);

        // Initialize with retry on the known transient "Execution context was destroyed" error
        this._initializeWithRetry(client, userId);

        return client;
    }

    /**
     * Wraps client.initialize() with retry logic for the known Puppeteer
     * "Execution context was destroyed" transient error during WA Web navigation.
     */
    async _initializeWithRetry(client, userId, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                await client.initialize();
                return; // success
            } catch (err) {
                const isContextError = err.message && err.message.includes('Execution context was destroyed');
                if (isContextError && attempt < retries) {
                    console.warn(`[SessionManager] Init attempt ${attempt} failed (context destroyed), retrying in 3s...`);
                    await new Promise(r => setTimeout(r, 3000));
                } else {
                    console.error(`[SessionManager] Failed to initialize for user ${userId}:`, err.message);
                    this.clients.delete(userId);
                    this.io.to(`user_${userId}`).emit('session_error', { error: 'Failed to start browser session. Please try again.' });
                    return;
                }
            }
        }
    }

    /**
     * Initialize all 'active' sessions for all users on startup.
     */
    async initAllActive() {
        try {
            const [sessions] = await db.query("SELECT * FROM whatsapp_sessions WHERE status = 'active'");
            for (const s of sessions) {
                this.getOrCreateSession(s.user_id, s.id);
            }
        } catch (err) {
            console.error('[SessionManager] Init Error:', err.message);
        }
    }

    isReady(userId) {
        const client = this.clients.get(userId);
        return !!(client && client.info);
    }

    async destroySession(userId) {
        const client = this.clients.get(userId);
        if (client) {
            try { await client.logout(); } catch (e) { }
            try { await client.destroy(); } catch (e) { }
            this.clients.delete(userId);
        }

        this._removeSessionFiles(userId);

        await db.query("UPDATE whatsapp_sessions SET status = 'disconnected' WHERE user_id = ?", [userId])
            .catch(() => { });

        this.io.to(`user_${userId}`).emit('session_status', {
            status: 'disconnected',
            sessionId: 'default',
            message: 'WhatsApp Disconnected.'
        });
    }

    _removeSessionFiles(userId) {
        const sessionPath = path.resolve(process.env.SESSION_DATA_PATH || './sessions');
        const localAuthPath = path.join(sessionPath, `session-session_${userId}`);
        try {
            fs.rmSync(localAuthPath, { recursive: true, force: true });
        } catch (e) {
            console.warn(`[SessionManager] Could not remove session files for user ${userId}:`, e.message);
        }
    }

    async _markOptOut(userId, phone) {
        const [result] = await db.query(
            `UPDATE contacts
                SET do_not_message = 1, consent_status = 'do_not_message', opt_out_at = COALESCE(opt_out_at, NOW())
              WHERE user_id = ? AND phone = ?`,
            [userId, phone]
        );

        if (result.affectedRows === 0) {
            await db.query(
                `INSERT INTO contacts (user_id, name, phone, source, do_not_message, consent_status, opt_out_at)
                 VALUES (?, ?, ?, 'customer_inquiry', 1, 'do_not_message', NOW())`,
                [userId, `Contact ${phone}`, phone]
            );
        }
    }

    async _handleAutoReply(client, userId, phone, text) {
        const [bots] = await db.query(
            `SELECT keyword, reply_text, reply_type
               FROM message_bots
              WHERE user_id = ? AND is_active = 1
              ORDER BY COALESCE(priority, 100) ASC, created_at ASC`,
            [userId]
        );

        const normalized = text.toLowerCase().trim();
        const bot = bots.find(row => {
            const keyword = String(row.keyword || '').toLowerCase().trim();
            if (!keyword) return false;
            return row.reply_type === 'exact' ? normalized === keyword : normalized.includes(keyword);
        });

        if (!bot) return;

        await client.sendMessage(`${phone}@c.us`, bot.reply_text);
        await db.query(
            `INSERT INTO chat_logs (user_id, contact_phone, body, direction)
             VALUES (?, ?, ?, 'out')`,
            [userId, phone, bot.reply_text]
        );
    }

    // Attach all WhatsApp lifecycle events and emit to the user's socket room
    _attachEventListeners(client, userId, sessionId) {
        const room = `user_${userId}`;

        client.on('qr', (qr) => {
            this.io.to(room).emit('qr_code', { qr, sessionId });
        });

        client.on('ready', () => {
            console.log(`[SessionManager] Client ready for user ${userId}`);

            const statusUpdate = 'active';
            if (sessionId === 'default') {
                db.query("UPDATE whatsapp_sessions SET status = ? WHERE user_id = ?", [statusUpdate, userId])
                    .then(([result]) => {
                        if (result.affectedRows === 0) {
                            return db.query("INSERT INTO whatsapp_sessions (user_id, status) VALUES (?, ?)", [userId, statusUpdate]);
                        }
                    })
                    .catch(err => console.error('[SessionManager] DB update/insert error:', err.message));
            } else {
                db.query("UPDATE whatsapp_sessions SET status = ? WHERE id = ?", [statusUpdate, sessionId])
                    .catch(err => console.error('[SessionManager] DB update error:', err.message));
            }

            this.io.to(room).emit('session_status', { status: 'ready', sessionId, message: 'WhatsApp Connected!' });
        });

        client.on('auth_failure', (msg) => {
            console.error(`[SessionManager] Auth failure for user ${userId}:`, msg);
            this._removeSessionFiles(userId);
            this.io.to(room).emit('session_status', { status: 'disconnected', sessionId, message: 'Authentication failed. Please re-scan.' });
        });

        client.on('message', async (message) => {
            try {
                if (!message || message.fromMe || !message.from || message.from.includes('@g.us')) return;
                const phone = String(message.from).split('@')[0];
                const body = String(message.body || '').trim();
                if (!phone || !body) return;

                await db.query(
                    `INSERT INTO chat_logs (user_id, contact_phone, body, direction)
                     VALUES (?, ?, ?, 'in')`,
                    [userId, phone, body]
                );
                this.io.to(room).emit('message_received', {
                    contactPhone: phone,
                    body,
                    direction: 'in',
                    created_at: new Date().toISOString()
                });

                const normalized = body.toLowerCase().replace(/[.!?]/g, '').trim();
                if (OPT_OUT_WORDS.has(normalized)) {
                    await this._markOptOut(userId, phone);
                    this.io.to(room).emit('contact_opt_out', { phone, message: 'Contact marked do not message.' });
                    return;
                }

                await this._handleAutoReply(client, userId, phone, body);
            } catch (err) {
                console.error(`[SessionManager] Incoming message handling failed for user ${userId}:`, err.message);
            }
        });

        client.on('disconnected', (reason) => {
            console.log(`[SessionManager] Client disconnected for user ${userId}:`, reason);

            if (sessionId === 'default') {
                db.query("UPDATE whatsapp_sessions SET status = 'disconnected' WHERE user_id = ?", [userId])
                    .catch(() => { });
            } else {
                db.query("UPDATE whatsapp_sessions SET status = 'disconnected' WHERE id = ?", [sessionId])
                    .catch(() => { });
            }

            this.clients.delete(userId);
            this._removeSessionFiles(userId);
            this.io.to(room).emit('session_status', { status: 'disconnected', sessionId, message: 'WhatsApp Disconnected.' });
        });
    }
}

module.exports = SessionManager;
