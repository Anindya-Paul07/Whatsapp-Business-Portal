const express = require('express');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { runCampaign, stopCampaign } = require('../services/CampaignRunner');

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
            return res.json({ success: true, campaigns: rows });
        } catch (err) {
            console.error('[Campaigns] List error:', err.message);
            return res.status(500).json({ success: false, message: 'Server error' });
        }
    });

    // ── POST /campaigns ─────────────────────────────────────────
    router.post('/', authMiddleware, async (req, res) => {
        const { name, message } = req.body;
        if (!name || !message) {
            return res.status(400).json({ success: false, message: 'name and message are required' });
        }

        try {
            const [result] = await db.query(
                `INSERT INTO campaigns (user_id, name, message, status)
         VALUES (?, ?, ?, 'pending')`,
                [req.user.id, name, message]
            );
            return res.status(201).json({ success: true, campaignId: result.insertId });
        } catch (err) {
            console.error('[Campaigns] Create error:', err.message);
            return res.status(500).json({ success: false, message: 'Server error' });
        }
    });

    // ── POST /campaigns/:id/run ─────────────────────────────────
    router.post('/:id/run', authMiddleware, async (req, res) => {
        const userId = req.user.id;
        const campaignId = parseInt(req.params.id, 10);

        const [[campaign]] = await db.query(
            `SELECT * FROM campaigns WHERE id = ? AND user_id = ? LIMIT 1`,
            [campaignId, userId]
        );
        if (!campaign) {
            return res.status(404).json({ success: false, message: 'Campaign not found' });
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

        let contacts;
        if (req.body.fromSource === 'database') {
            [contacts] = await db.query(
                `SELECT name, phone FROM contacts WHERE user_id = ?`,
                [userId]
            );
        } else {
            // In a real scenario, this would read from a temp CSV or the body
            // For now, default to database for the runner logic
            [contacts] = await db.query(`SELECT name, phone FROM contacts WHERE user_id = ?`, [userId]);
        }

        if (contacts.length === 0) {
            return res.status(400).json({ success: false, message: 'No contacts selected' });
        }

        const client = sessionManager.getOrCreateSession(userId);

        runCampaign({
            campaignId,
            userId,
            message: campaign.message,
            contacts,
            client,
            io,
        }).catch(err => console.error('[Campaigns] Runner error:', err.message));

        return res.json({
            success: true,
            message: `Campaign started. Monitor progress via 'campaign_update'.`,
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
