const express = require('express');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// ── GET /message-bots ─────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, keyword, reply_text, reply_type, is_active, created_at
                    , COALESCE(priority, 100) AS priority, COALESCE(is_system, 0) AS is_system
         FROM message_bots
        WHERE user_id = ?
        ORDER BY COALESCE(priority, 100) ASC, created_at DESC`,
            [req.user.id]
        );
        return res.json({ success: true, bots: rows });
    } catch (err) {
        console.error('[MessageBots] List error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ── POST /message-bots ────────────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
    const { keyword, reply_text, reply_type, priority } = req.body;

    if (!keyword || !reply_text) {
        return res.status(400).json({ success: false, message: 'keyword and reply_text are required' });
    }
    const safeType = ['exact', 'contains'].includes(reply_type) ? reply_type : 'contains';

    try {
        const [result] = await db.query(
            `INSERT INTO message_bots (user_id, keyword, reply_text, reply_type)
       VALUES (?, ?, ?, ?)`,
            [req.user.id, keyword, reply_text, safeType]
        );
        if (priority !== undefined) {
            await db.query(`UPDATE message_bots SET priority = ? WHERE id = ?`, [Math.max(parseInt(priority, 10) || 100, 1), result.insertId]);
        }
        return res.status(201).json({ success: true, botId: result.insertId });
    } catch (err) {
        console.error('[MessageBots] Create error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ── PUT /message-bots/:id ─────────────────────────────────────
router.put('/:id', authMiddleware, async (req, res) => {
    const { keyword, reply_text, reply_type, is_active, priority } = req.body;
    const safeType = ['exact', 'contains'].includes(reply_type) ? reply_type : 'contains';

    try {
        const [[bot]] = await db.query(
            `SELECT is_system FROM message_bots WHERE id = ? AND user_id = ? LIMIT 1`,
            [req.params.id, req.user.id]
        );
        if (!bot) return res.status(404).json({ success: false, message: 'Bot not found' });
        if (bot.is_system && is_active === false) {
            return res.status(400).json({ success: false, message: 'Protected opt-out rule must stay active' });
        }

        const [result] = await db.query(
            `UPDATE message_bots
          SET keyword = ?, reply_text = ?, reply_type = ?, is_active = ?, priority = ?
        WHERE id = ? AND user_id = ?`,
            [keyword, reply_text, safeType, is_active ? 1 : 0, Math.max(parseInt(priority, 10) || 100, 1), req.params.id, req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Bot not found' });
        }
        return res.json({ success: true, message: 'Bot updated' });
    } catch (err) {
        console.error('[MessageBots] Update error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ── DELETE /message-bots/:id ──────────────────────────────────
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const [[bot]] = await db.query(
            `SELECT is_system FROM message_bots WHERE id = ? AND user_id = ? LIMIT 1`,
            [req.params.id, req.user.id]
        );
        if (bot?.is_system) {
            return res.status(400).json({ success: false, message: 'Protected opt-out rule cannot be deleted' });
        }
        const [result] = await db.query(
            `DELETE FROM message_bots WHERE id = ? AND user_id = ?`,
            [req.params.id, req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Bot not found' });
        }
        return res.json({ success: true, message: 'Bot deleted' });
    } catch (err) {
        console.error('[MessageBots] Delete error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
