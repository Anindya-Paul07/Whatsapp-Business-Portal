const express = require('express');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// ── GET /bots ─────────────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, keyword, reply_text, reply_type, is_active, created_at
         FROM template_bots
        WHERE user_id = ?
        ORDER BY created_at DESC`,
            [req.user.id]
        );
        return res.json({ success: true, bots: rows });
    } catch (err) {
        console.error('[Bots] List error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ── POST /bots ────────────────────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
    const { keyword, reply_text, reply_type } = req.body;

    if (!keyword || !reply_text) {
        return res.status(400).json({ success: false, message: 'keyword and reply_text are required' });
    }
    const safeType = ['exact', 'contains'].includes(reply_type) ? reply_type : 'contains';

    try {
        const [result] = await db.query(
            `INSERT INTO template_bots (user_id, keyword, reply_text, reply_type)
       VALUES (?, ?, ?, ?)`,
            [req.user.id, keyword, reply_text, safeType]
        );
        return res.status(201).json({ success: true, botId: result.insertId });
    } catch (err) {
        console.error('[Bots] Create error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ── PUT /bots/:id ─────────────────────────────────────────────
router.put('/:id', authMiddleware, async (req, res) => {
    const { keyword, reply_text, reply_type, is_active } = req.body;
    const safeType = ['exact', 'contains'].includes(reply_type) ? reply_type : 'contains';

    try {
        const [result] = await db.query(
            `UPDATE template_bots
          SET keyword = ?, reply_text = ?, reply_type = ?, is_active = ?
        WHERE id = ? AND user_id = ?`,
            [keyword, reply_text, safeType, is_active ? 1 : 0, req.params.id, req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Bot not found' });
        }
        return res.json({ success: true, message: 'Bot updated' });
    } catch (err) {
        console.error('[Bots] Update error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ── DELETE /bots/:id ──────────────────────────────────────────
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const [result] = await db.query(
            `DELETE FROM template_bots WHERE id = ? AND user_id = ?`,
            [req.params.id, req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Bot not found' });
        }
        return res.json({ success: true, message: 'Bot deleted' });
    } catch (err) {
        console.error('[Bots] Delete error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
