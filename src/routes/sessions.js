const express = require('express');
const { authMiddleware } = require('../middleware/auth');

/**
 * Factory function so routes have access to the SessionManager.
 * @param {SessionManager} sessionManager
 */
module.exports = function createSessionRoutes(sessionManager) {
    const router = express.Router();

    // ──────────────────────────────────────────────────────────────
    //  POST /sessions/init
    //  Starts (or retrieves) a Puppeteer+WhatsApp session for the
    //  authenticated user.  The QR code is pushed via Socket.IO to
    //  the user's private room.
    // ──────────────────────────────────────────────────────────────
    router.post('/init', authMiddleware, (req, res) => {
        const userId = req.user.id;

        if (sessionManager.isReady(userId)) {
            return res.json({
                success: true,
                message: 'Session already active',
                status: 'ready',
            });
        }

        // This is non-blocking: initialisation happens in the background;
        // QR will arrive via Socket.IO event 'qr_code'.
        sessionManager.getOrCreateSession(userId);

        return res.json({
            success: true,
            message: 'Session initialisation started. Await qr_code event via Socket.IO.',
            status: 'initialising',
        });
    });

    // ──────────────────────────────────────────────────────────────
    //  GET /sessions/status
    // ──────────────────────────────────────────────────────────────
    router.get('/status', authMiddleware, (req, res) => {
        const userId = req.user.id;
        const ready = sessionManager.isReady(userId);
        return res.json({
            success: true,
            status: ready ? 'ready' : 'not_connected',
        });
    });

    // ──────────────────────────────────────────────────────────────
    //  DELETE /sessions/destroy
    // ──────────────────────────────────────────────────────────────
    router.delete('/destroy', authMiddleware, async (req, res) => {
        const userId = req.user.id;
        await sessionManager.destroySession(userId);
        return res.json({ success: true, message: 'Session destroyed' });
    });

    return router;
};
