const express = require('express');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

/**
 * Factory — needs sessionManager to send manual replies.
 */
module.exports = function createChatRoutes(sessionManager) {
    const router = express.Router();

    // ── GET /chats/:phone ─────────────────────────────────────────
    // Fetch message history with a specific contact.
    router.get('/:phone', authMiddleware, async (req, res) => {
        const { phone } = req.params;
        const limit = parseInt(req.query.limit || '50', 10);
        const offset = parseInt(req.query.offset || '0', 10);

        try {
            const [rows] = await db.query(
                `SELECT id, body, direction, created_at
           FROM chat_logs
          WHERE user_id = ? AND contact_phone = ?
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?`,
                [req.user.id, phone, limit, offset]
            );
            return res.json({ success: true, messages: rows.reverse() });
        } catch (err) {
            console.error('[Chat] History error:', err.message);
            return res.status(500).json({ success: false, message: 'Server error' });
        }
    });

    // ── GET /chats ────────────────────────────────────────────────
    // List all distinct conversations (unique phones).
    router.get('/', authMiddleware, async (req, res) => {
        try {
            const [rows] = await db.query(
                `SELECT contact_phone,
                MAX(created_at)  AS last_message_at,
                COUNT(*)         AS message_count
           FROM chat_logs
          WHERE user_id = ?
          GROUP BY contact_phone
          ORDER BY last_message_at DESC`,
                [req.user.id]
            );
            return res.json({ success: true, conversations: rows });
        } catch (err) {
            console.error('[Chat] Conversations error:', err.message);
            return res.status(500).json({ success: false, message: 'Server error' });
        }
    });

    // ── POST /chats/:phone/send ───────────────────────────────────
    // Send a manual reply to a specific contact.
    router.post('/:phone/send', authMiddleware, async (req, res) => {
        const userId = req.user.id;
        const phone = req.params.phone;
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ success: false, message: 'message body is required' });
        }

        if (!sessionManager.isReady(userId)) {
            return res.status(400).json({
                success: false,
                message: 'WhatsApp session not ready. Please call /sessions/init first.',
            });
        }

        try {
            const client = sessionManager.getOrCreateSession(userId);
            const chatId = phone.replace(/\D/g, '') + '@c.us';

            await client.sendMessage(chatId, message);

            // Persist outbound log
            await db.query(
                `INSERT INTO chat_logs (user_id, contact_phone, body, direction)
         VALUES (?, ?, ?, 'out')`,
                [userId, phone, message]
            );

            return res.json({ success: true, message: 'Message sent' });
        } catch (err) {
            console.error('[Chat] Send error:', err.message);
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    return router;
};
