const express = require('express');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Configure multer for media in templates
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/templates';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'template-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// ── GET /templates ────────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM message_templates WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json({ success: true, templates: rows });
    } catch (err) {
        console.error('[Templates] List error:', err.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ── POST /templates ───────────────────────────────────────────
router.post('/', authMiddleware, upload.single('media'), async (req, res) => {
    const { name, message, category, buttons } = req.body;
    if (!name || !message) {
        return res.status(400).json({ success: false, message: 'Name and message are required' });
    }

    const mediaUrl = req.file ? `uploads/templates/${req.file.filename}` : null;
    let parsedButtons = null;
    try {
        if (buttons) parsedButtons = JSON.parse(buttons);
    } catch (e) { }

    try {
        const [result] = await db.query(
            'INSERT INTO message_templates (user_id, name, message, category, media_url, buttons) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, name, message, category || 'marketing', mediaUrl, JSON.stringify(parsedButtons)]
        );
        res.status(201).json({ success: true, templateId: result.insertId });
    } catch (err) {
        console.error('[Templates] Create error:', err.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ── DELETE /templates/:id ─────────────────────────────────────
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const [result] = await db.query(
            'DELETE FROM message_templates WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Template not found' });
        }
        res.json({ success: true, message: 'Template deleted' });
    } catch (err) {
        console.error('[Templates] Delete error:', err.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
