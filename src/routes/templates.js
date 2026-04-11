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
const upload = multer({
    storage,
    limits: { fileSize: 16 * 1024 * 1024 }
});

function parseButtons(buttons) {
    if (!buttons) return [];
    let parsed = buttons;
    if (typeof buttons === 'string') {
        try {
            parsed = JSON.parse(buttons);
        } catch (_) {
            parsed = [];
        }
    }
    if (!Array.isArray(parsed)) return [];
    return parsed
        .map(btn => ({ text: String(btn.text || btn.body || '').trim() }))
        .filter(btn => btn.text)
        .slice(0, 3);
}

function validateTemplate({ name, message, buttons }) {
    if (!name || !String(name).trim()) return 'Template name is required';
    if (!message || !String(message).trim()) return 'Message is required';
    if (buttons.length > 3) return 'Use 3 buttons or fewer';
    if (buttons.some(btn => !btn.text)) return 'Button text is required';
    return null;
}

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

    const mediaUrl = req.file ? `uploads/templates/${req.file.filename}` : null;
    try {
        const parsedButtons = parseButtons(buttons);
        const validation = validateTemplate({ name, message, buttons: parsedButtons });
        if (validation) {
            if (req.file) fs.unlink(req.file.path, () => { });
            return res.status(400).json({ success: false, message: validation });
        }

        const [result] = await db.query(
            'INSERT INTO message_templates (user_id, name, message, category, media_url, buttons) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, name, message, category || 'marketing', mediaUrl, JSON.stringify(parsedButtons)]
        );
        res.status(201).json({ success: true, templateId: result.insertId });
    } catch (err) {
        console.error('[Templates] Create error:', err.message);
        if (req.file) fs.unlink(req.file.path, () => { });
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ── PUT /templates/:id ─────────────────────────────────────────
router.put('/:id', authMiddleware, upload.single('media'), async (req, res) => {
    const { name, message, category, buttons, remove_media } = req.body;

    try {
        const [[existing]] = await db.query(
            'SELECT * FROM message_templates WHERE id = ? AND user_id = ? LIMIT 1',
            [req.params.id, req.user.id]
        );
        if (!existing) {
            if (req.file) fs.unlink(req.file.path, () => { });
            return res.status(404).json({ success: false, message: 'Template not found' });
        }

        const parsedButtons = parseButtons(buttons);
        const validation = validateTemplate({ name, message, buttons: parsedButtons });
        if (validation) {
            if (req.file) fs.unlink(req.file.path, () => { });
            return res.status(400).json({ success: false, message: validation });
        }

        const nextMediaUrl = req.file
            ? `uploads/templates/${req.file.filename}`
            : (remove_media === 'true' ? null : existing.media_url);

        await db.query(
            `UPDATE message_templates
                SET name = ?, message = ?, category = ?, media_url = ?, buttons = ?
              WHERE id = ? AND user_id = ?`,
            [name, message, category || existing.category || 'marketing', nextMediaUrl, JSON.stringify(parsedButtons), req.params.id, req.user.id]
        );

        return res.json({ success: true, message: 'Template updated' });
    } catch (err) {
        console.error('[Templates] Update error:', err.message);
        if (req.file) fs.unlink(req.file.path, () => { });
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ── POST /templates/:id/duplicate ──────────────────────────────
router.post('/:id/duplicate', authMiddleware, async (req, res) => {
    try {
        const [[template]] = await db.query(
            'SELECT * FROM message_templates WHERE id = ? AND user_id = ? LIMIT 1',
            [req.params.id, req.user.id]
        );
        if (!template) return res.status(404).json({ success: false, message: 'Template not found' });

        const [result] = await db.query(
            'INSERT INTO message_templates (user_id, name, message, category, media_url, buttons) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, `${template.name} copy`, template.message, template.category, template.media_url, template.buttons]
        );
        return res.status(201).json({ success: true, templateId: result.insertId });
    } catch (err) {
        console.error('[Templates] Duplicate error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
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
