const db = require('../config/db');

/**
 * BanGuardService
 * ─────────────────────────────────────────────────────────────
 * Monitors for potential account bans or delivery failures
 * and automatically triggers protective measures.
 */
class BanGuardService {
    /**
     * Report a delivery failure or block indicator.
     * @param {number} sessionId The ID from 'whatsapp_sessions'
     */
    static async reportFailure(sessionId) {
        try {
            // Logic: If a session gets 3 failures in 10 minutes,
            // put it into 'cooldown' status for an hour.
            const [rows] = await db.query(`
                SELECT COUNT(*) as recent_fails FROM chat_logs
                WHERE created_at >= NOW() - INTERVAL 10 MINUTE
                  AND direction = 'out'
                  AND status = 'failed'
                  AND session_id = ?
            `, [sessionId]);

            if (rows[0].recent_fails >= 3) {
                console.warn(`[BanGuard] Moving session ${sessionId} to cooldown due to repeated failures.`);
                await db.query(`
                    UPDATE whatsapp_sessions SET status = 'cooldown' WHERE id = ?
                `, [sessionId]);

                // Could add a timer here to restore to 'active' after an hour.
                return true;
            }
            return false;
        } catch (err) {
            console.error('[BanGuardService] Report Error:', err.message);
            return false;
        }
    }

    /**
     * Check if a phone number is blacklisted before sending.
     * @param {number} userId
     * @param {string} phone
     * @returns {Promise<boolean>}
     */
    static async isBlacklisted(userId, phone) {
        try {
            const [rows] = await db.query(`
                SELECT 1 FROM blacklist WHERE user_id = ? AND phone_number = ? LIMIT 1
            `, [userId, phone.replace(/\D/g, '')]);
            return rows.length > 0;
        } catch (err) {
            console.error('[BanGuardService] Blacklist Check Error:', err.message);
            return false;
        }
    }
}

module.exports = BanGuardService;
