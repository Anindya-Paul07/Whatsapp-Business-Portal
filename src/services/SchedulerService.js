const cron = require('node-cron');
const db = require('../config/db');
const { runCampaign } = require('./CampaignRunner');

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
    }

    /**
     * Start the campaign scheduler.
     */
    start() {
        // Poll every minute
        cron.schedule('* * * * *', async () => {
            console.log('[SchedulerService] Checking for scheduled campaigns...');
            await this.processScheduled();
        });
    }

    /**
     * Fetch and launch scheduled campaigns.
     */
    async processScheduled() {
        try {
            // Find 'pending' campaigns that are scheduled for now or earlier
            const [rows] = await db.query(`
                SELECT c.*, t.message, t.media_url, t.buttons
                FROM campaigns c
                JOIN message_templates t ON c.template_id = t.id
                WHERE c.status = 'pending'
                  AND c.scheduled_at <= NOW()
            `);

            for (const campaign of rows) {
                const userId = campaign.user_id;

                if (!this.sessionManager.isReady(userId)) {
                    console.warn(`[SchedulerService] Session not ready for user ${userId}, skipping campaign ${campaign.id}`);
                    continue;
                }

                // Fetch contacts for this user (assume all CRM database contacts for now)
                const [contacts] = await db.query(
                    `SELECT name, phone FROM contacts WHERE user_id = ?`,
                    [userId]
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
                    message: campaign.message,
                    mediaUrl: campaign.media_url,
                    buttons: parsedButtons,
                    contacts,
                    client,
                    io: this.io,
                }).catch(err => console.error('[SchedulerService] Runner error:', err.message));

                console.log(`[SchedulerService] Launched scheduled campaign ${campaign.id} for user ${userId}`);
            }
        } catch (err) {
            console.error('[SchedulerService] Process Error:', err.message);
        }
    }
}

module.exports = SchedulerService;
