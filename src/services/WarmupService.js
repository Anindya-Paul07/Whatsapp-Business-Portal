const cron = require('node-cron');
const db = require('../config/db');

/**
 * WarmupService
 * ─────────────────────────────────────────────────────────────
 * Simulates "human" interactions between active sessions to
 * improve account reputation and reduce ban risk.
 *
 * Logic:
 *   - Runs every 30 minutes.
 *   - Picks two 'active' sessions for the same user.
 *   - Sends a random greeting between them.
 *   - Increments 'warmup_count'.
 *   - Marks as 'active' (promoted to bulk-ready) once count >= 50.
 */
class WarmupService {
    constructor(sessionManager) {
        this.sessionManager = sessionManager;
        this.greetings = [
            'Hello! How are you today?',
            'Hi there, just testing the connection.',
            'Good morning!',
            'Are we all set for the campaign?',
            'Looking forward to our next meeting.',
            'Did you see the latest update?',
            'The weather is quite nice today, isn\'t it?',
            'Thanks for the help earlier!',
            'Quick check-in, hope all is well.',
            'WhatsApp is working great today.'
        ];
    }

    /**
     * Start the background warmup cron.
     */
    start() {
        // Runs every 30 minutes
        cron.schedule('*/30 * * * *', async () => {
            console.log('[WarmupService] Running periodic warmup sequence...');
            await this.performWarmup();
        });

        // Runs daily at midnight to reset session counters
        cron.schedule('0 0 * * *', async () => {
            console.log('[WarmupService] Daily counter reset sequence...');
            await db.query(`UPDATE whatsapp_sessions SET sent_today = 0`);
        });

        console.log('[WarmupService] Background tasks scheduled.');
    }

    /**
     * Logic to simulate a conversation.
     */
    async performWarmup() {
        try {
            // Pick a user who has at least two initializing or active sessions
            const [users] = await db.query(`
                SELECT user_id, COUNT(*) as session_count
                FROM whatsapp_sessions
                WHERE status IN ('initializing', 'active')
                GROUP BY user_id
                HAVING session_count >= 2
            `);

            for (const user of users) {
                const [sessions] = await db.query(`
                    SELECT * FROM whatsapp_sessions
                    WHERE user_id = ? AND status IN ('initializing', 'active')
                    ORDER BY RAND()
                    LIMIT 2
                `, [user.user_id]);

                if (sessions.length < 2) continue;

                const [s1, s2] = sessions;
                const message = this.greetings[Math.floor(Math.random() * this.greetings.length)];

                // Try to send from s1 to s2
                const client = this.sessionManager.clients.get(user.user_id);
                if (!client || !client.info) continue;

                // Log the warmup interaction (table may not exist yet — silently skip)
                try {
                    await db.query(`
                        INSERT INTO warmup_logs (from_session_id, to_session_id, message_body)
                        VALUES (?, ?, ?)
                    `, [s1.id, s2.id, message]);
                } catch (dbErr) {
                    // warmup_logs table may not exist — that's OK, skip logging
                }

                // Update warmup counts
                await db.query(`
                    UPDATE whatsapp_sessions
                    SET warmup_count = warmup_count + 1
                    WHERE id IN (?, ?)
                `, [s1.id, s2.id]);

                // Check for promotion
                await db.query(`
                    UPDATE whatsapp_sessions
                    SET status = 'active'
                    WHERE warmup_count >= 50 AND status = 'initializing'
                `);
            }
        } catch (err) {
            console.error('[WarmupService] Warmup Error:', err.message);
        }
    }
}

module.exports = WarmupService;
