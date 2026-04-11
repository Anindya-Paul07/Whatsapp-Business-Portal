const db = require('../config/db');
const { runCampaign } = require('./CampaignRunner');

function parseTime(value, fallback) {
    const raw = String(value || fallback || '00:00:00');
    const [h, m] = raw.split(':').map(part => parseInt(part, 10));
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function isInsideSendWindow(start, end) {
    const now = new Date();
    const current = now.getHours() * 60 + now.getMinutes();
    const startMinutes = parseTime(start, '10:00:00');
    const endMinutes = parseTime(end, '20:00:00');
    if (startMinutes <= endMinutes) return current >= startMinutes && current <= endMinutes;
    return current >= startMinutes || current <= endMinutes;
}

/**
 * SchedulerService
 * ─────────────────────────────────────────────────────────────
 * Polls for campaigns that are 'pending' and have a
 * 'scheduled_at' timestamp that is now or in the past.
 */
class SchedulerService {
    constructor(sessionManager, io) {
        this.sessionManager = sessionManager;
        this.io = io;
        this.interval = null;
        this.isProcessing = false;
    }

    /**
     * Start the campaign scheduler.
     */
    start() {
        if (this.interval) return;

        const tick = async () => {
            if (this.isProcessing) return;
            this.isProcessing = true;
            try {
                console.log('[SchedulerService] Checking for scheduled campaigns...');
                await this.processScheduled();
            } finally {
                this.isProcessing = false;
            }
        };

        this.interval = setInterval(tick, 60 * 1000);
        tick();
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
        this.interval = null;
    }

    /**
     * Fetch and launch scheduled campaigns.
     */
    async processScheduled() {
        try {
            // Find 'pending' campaigns that are scheduled for now or earlier
            const [rows] = await db.query(`
                SELECT c.*, t.message AS template_message, t.media_url AS template_media_url, t.buttons
                FROM campaigns c
                LEFT JOIN message_templates t ON c.template_id = t.id
                WHERE c.status = 'pending'
                  AND c.scheduled_at <= NOW()
            `);

            for (const campaign of rows) {
                const userId = campaign.user_id;

                if (!isInsideSendWindow(campaign.send_window_start, campaign.send_window_end)) {
                    console.log(`[SchedulerService] Campaign ${campaign.id} is outside the send window, waiting.`);
                    continue;
                }

                if (!this.sessionManager.isReady(userId)) {
                    console.warn(`[SchedulerService] Session not ready for user ${userId}, skipping campaign ${campaign.id}`);
                    continue;
                }

                // Scheduled campaigns must use their saved recipient snapshot.
                const [contacts] = await db.query(
                    `SELECT id AS recipient_id, contact_id, name, phone, status
                       FROM campaign_recipients
                      WHERE campaign_id = ? AND status = 'pending'
                      ORDER BY id ASC`,
                    [campaign.id]
                );

                if (contacts.length === 0) {
                    await db.query(`UPDATE campaigns SET status = 'failed' WHERE id = ?`, [campaign.id]);
                    continue;
                }

                const client = this.sessionManager.getOrCreateSession(userId);

                let parsedButtons = [];
                try {
                    if (campaign.buttons) {
                        parsedButtons = typeof campaign.buttons === 'string'
                            ? JSON.parse(campaign.buttons)
                            : campaign.buttons;
                    }
                } catch (e) {
                    console.error('[SchedulerService] Button parse error:', e.message);
                }

                // Launch campaign runner
                runCampaign({
                    campaignId: campaign.id,
                    userId,
                    message: campaign.template_message || campaign.message,
                    mediaUrl: campaign.template_media_url || campaign.media_url,
                    buttons: parsedButtons,
                    contacts,
                    client,
                    io: this.io,
                    batchLimit: campaign.batch_limit || 50,
                    settings: campaign
                }).catch(err => console.error('[SchedulerService] Runner error:', err.message));

                console.log(`[SchedulerService] Launched scheduled campaign ${campaign.id} for user ${userId}`);
            }
        } catch (err) {
            console.error('[SchedulerService] Process Error:', err.message);
        }
    }
}

module.exports = SchedulerService;
