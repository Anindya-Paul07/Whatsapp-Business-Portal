const express = require('express');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { runCampaign, stopCampaign, getLiveProgress } = require('../services/CampaignRunner');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

const upload = multer({ dest: 'uploads/' });

/**
 * Factory so routes have access to SessionManager and io.
 */
module.exports = function createCampaignRoutes(sessionManager, io) {
    const router = express.Router();

    // ── GET /campaigns ──────────────────────────────────────────
    router.get('/', authMiddleware, async (req, res) => {
        try {
            const [rows] = await db.query(
                `SELECT id, name, message, status, sent_count, fail_count, created_at
           FROM campaigns
          WHERE user_id = ?
          ORDER BY created_at DESC`,
                [req.user.id]
            );

            // Augment with live progress if running
            const augmented = rows.map(c => {
                if (c.status === 'processing') {
                    const live = getLiveProgress(c.id);
                    return live ? { ...c, ...live } : c;
                }
                return c;
            });

            return res.json({ success: true, campaigns: augmented });
        } catch (err) {
            console.error('[Campaigns] List error:', err.message);
            return res.status(500).json({ success: false, message: 'Server error' });
        }
    });

    // ── POST /campaigns ─────────────────────────────────────────
    router.post('/', authMiddleware, upload.none(), async (req, res) => {
        const { name, template_id } = req.body;
        if (!name || !template_id) {
            return res.status(400).json({ success: false, message: 'name and template_id are required' });
        }

        try {
            const [result] = await db.query(
                `INSERT INTO campaigns (user_id, name, template_id, status)
                 VALUES (?, ?, ?, 'pending')`,
                [req.user.id, name, template_id]
            );
            return res.status(201).json({ success: true, campaignId: result.insertId });
        } catch (err) {
            console.error('[Campaigns] Create error:', err.message);
            return res.status(500).json({ success: false, message: 'Server error' });
        }
    });

    // ── POST /campaigns/:id/run ─────────────────────────────────
    router.post('/:id/run', authMiddleware, upload.single('file'), async (req, res) => {
        const userId = req.user.id;
        const campaignId = parseInt(req.params.id, 10);

        const [[campaign]] = await db.query(
            `SELECT c.*, t.message, t.media_url, t.buttons FROM campaigns c 
             JOIN message_templates t ON c.template_id = t.id 
             WHERE c.id = ? AND c.user_id = ? LIMIT 1`,
            [campaignId, userId]
        );
        if (!campaign) {
            return res.status(404).json({ success: false, message: 'Campaign or Template not found' });
        }
        if (campaign.status === 'processing') {
            return res.status(409).json({ success: false, message: 'Campaign is already running' });
        }

        if (!sessionManager.isReady(userId)) {
            return res.status(400).json({
                success: false,
                message: 'WhatsApp session not ready.',
            });
        }

        let contacts = [];
        if (req.body.fromSource === 'database') {
            const [rows] = await db.query(
                `SELECT name, phone FROM contacts WHERE user_id = ?`,
                [userId]
            );
            contacts = rows;
        } else if (req.body.fromSource === 'csv' && req.file) {
            // Parse CSV file
            try {
                contacts = await new Promise((resolve, reject) => {
                    const results = [];
                    fs.createReadStream(req.file.path)
                        .pipe(csv())
                        .on('data', (data) => {
                            // Support various header names
                            const name = data.name || data.Name || data.contact_name || '';
                            const phone = data.phone || data.Phone || data.number || data.whatsapp_number;
                            if (phone) {
                                results.push({ name, phone: phone.toString().replace(/\D/g, '') });
                            }
                        })
                        .on('end', () => {
                            fs.unlinkSync(req.file.path); // Clean up temp file
                            resolve(results);
                        })
                        .on('error', reject);
                });
            } catch (err) {
                console.error('[Campaigns] CSV parse error:', err.message);
                return res.status(400).json({ success: false, message: 'Failed to parse CSV file' });
            }
        }

        if (contacts.length === 0) {
            return res.status(400).json({ success: false, message: 'No contacts selected or invalid CSV' });
        }

        const client = sessionManager.getOrCreateSession(userId);

        let parsedButtons = [];
        try { if (campaign.buttons) parsedButtons = typeof campaign.buttons === 'string' ? JSON.parse(campaign.buttons) : campaign.buttons; } catch (e) { }

        runCampaign({
            campaignId,
            userId,
            message: campaign.message,
            mediaUrl: campaign.media_url,
            buttons: parsedButtons,
            contacts,
            client,
            io,
        }).catch(err => console.error('[Campaigns] Runner error:', err.message));

        return res.json({
            success: true,
            message: `Campaign started with ${contacts.length} contacts.`,
        });
    });

    // ── POST /campaigns/:id/stop ────────────────────────────────
    router.post('/:id/stop', authMiddleware, async (req, res) => {
        const campaignId = parseInt(req.params.id, 10);
        const userId = req.user.id;

        const [[campaign]] = await db.query(
            `SELECT id FROM campaigns WHERE id = ? AND user_id = ? LIMIT 1`,
            [campaignId, userId]
        );

        if (!campaign) {
            return res.status(404).json({ success: false, message: 'Campaign not found' });
        }

        const stopped = stopCampaign(campaignId);
        if (stopped) {
            return res.json({ success: true, message: 'Campaign stop signal sent.' });
        } else {
            return res.status(400).json({ success: false, message: 'Campaign is not running.' });
        }
    });

    router.put('/:id', authMiddleware, async (req, res) => {
        const { name, template_id } = req.body;
        const campaignId = req.params.id;

        try {
            const [result] = await db.query(
                `UPDATE campaigns SET name = ?, template_id = ?
                 WHERE id = ? AND user_id = ?`,
                [name, template_id, campaignId, req.user.id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, message: 'Campaign not found' });
            }
            return res.json({ success: true, message: 'Campaign updated' });
        } catch (err) {
            console.error('[Campaigns] Update error:', err.message);
            return res.status(500).json({ success: false, message: 'Server error' });
        }
    });

    // ── DELETE /campaigns/:id ───────────────────────────────────
    router.delete('/:id', authMiddleware, async (req, res) => {
        try {
            const [result] = await db.query(
                `DELETE FROM campaigns WHERE id = ? AND user_id = ?`,
                [req.params.id, req.user.id]
            );
            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, message: 'Campaign not found' });
            }
            return res.json({ success: true, message: 'Campaign deleted' });
        } catch (err) {
            console.error('[Campaigns] Delete error:', err.message);
            return res.status(500).json({ success: false, message: 'Server error' });
        }
    });

    return router;
};
