const db = require('../config/db');

/**
 * SessionRotator
 * ─────────────────────────────────────────────────────────────
 * Logic for selecting the best WhatsApp session for sending
 * a message in a campaign.
 *
 * It uses Least Recently Used (LRU) combined with Daily Limits.
 */
class SessionRotator {
    /**
     * Get the next available session for a user.
     * @param {number} userId
     * @returns {Promise<Object|null>} Session info or null
     */
    static async getNextSession(userId) {
        try {
            // Select the session that:
            // 1. Belongs to the user
            // 2. Is 'active' or 'ready'
            // 3. Hasn't hit its daily_limit
            // 4. Was used longest ago (LRU)
            const [rows] = await db.query(`
                SELECT * FROM whatsapp_sessions
                WHERE user_id = ?
                  AND status = 'active'
                  AND sent_today < daily_limit
                ORDER BY last_used_at ASC
                LIMIT 1
            `, [userId]);

            if (rows.length === 0) return null;

            const session = rows[0];

            // Update last_used_at to maintain LRU order
            await db.query(`
                UPDATE whatsapp_sessions
                SET last_used_at = NOW(), sent_today = sent_today + 1
                WHERE id = ?
            `, [session.id]);

            return session;
        } catch (err) {
            console.error('[SessionRotator] Error:', err.message);
            return null;
        }
    }

    /**
     * Reset sent_today counters daily.
     */
    static async resetDailyCounters() {
        try {
            await db.query(`UPDATE whatsapp_sessions SET sent_today = 0`);
            console.log('[SessionRotator] Daily counters reset.');
        } catch (err) {
            console.error('[SessionRotator] Reset Error:', err.message);
        }
    }
}

module.exports = SessionRotator;
