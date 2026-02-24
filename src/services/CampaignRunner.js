const db = require('../config/db');

/** @type {Map<number, boolean>} campaignId -> isRunning */
const activeCampaigns = new Map();

/**
 * Advanced Anti-Detection Helpers
 */
const getHumanDelay = () => Math.floor(Math.random() * (45000 - 20000 + 1)) + 20000;
const getDeepPause = () => Math.floor(Math.random() * (600000 - 300000 + 1)) + 300000; // 5-10 mins

/**
 * Handles {option1|option2} format for content uniqueness.
 */
function parseSpintax(text) {
    return text.replace(/\{([^{}]+)\}/g, (match, options) => {
        const choices = options.split('|');
        return choices[Math.floor(Math.random() * choices.length)];
    });
}

/**
 * Run a campaign with sophisticated anti-ban protocol.
 */
async function runCampaign({ campaignId, userId, message, contacts, client, io }) {
    const room = `user_${userId}`;
    let sentCount = 0;
    let failCount = 0;
    let rateLimitCooling = false;

    activeCampaigns.set(campaignId, true);

    await db.query(`UPDATE campaigns SET status = 'processing' WHERE id = ?`, [campaignId]);

    for (let i = 0; i < contacts.length; i++) {
        // 1. Manual Stop Check
        if (!activeCampaigns.get(campaignId)) break;

        // 2. Rate Limit Cooling Check
        if (rateLimitCooling) {
            console.warn(`[CampaignRunner] Rate limiting detected. Cooling down for 60s...`);
            await new Promise(r => setTimeout(r, 60000));
            rateLimitCooling = false;
        }

        // 3. Deep Pause every 15 messages
        if (i > 0 && i % 15 === 0) {
            const pauseTime = getDeepPause();
            console.log(`[Anti-Ban] Message limit reached. Deep Pause for ${(pauseTime / 60000).toFixed(1)} mins...`);
            io.to(room).emit('campaign_update', { campaignId, status: 'Deep Pause', progress: Math.round((i / contacts.length) * 100) });
            await new Promise(r => setTimeout(r, pauseTime));
        }

        const contact = contacts[i];
        const chatId = contact.phone.replace(/\D/g, '') + '@c.us';

        // --- Message Preparation ---
        let content = message.replace(/\{\{name\}\}/gi, contact.name || '');
        content = parseSpintax(content); // Apply spintax

        let success = true;
        try {
            // --- Human-Like Behaviour Wrapper ---
            await client.sendPresenceAvailable();
            const chat = await client.getChatById(chatId);

            // Simulating typing based on content length
            const typingSpeed = 50; // ms per char
            const typingTime = Math.min(content.length * typingSpeed, 10000); // capped at 10s for UX

            console.log(`Status: Simulating Typing for ${contact.phone}... ${(typingTime / 1000).toFixed(1)}s`);
            await chat.sendStateTyping();
            await new Promise(r => setTimeout(r, typingTime));

            const msgResult = await client.sendMessage(chatId, content);
            await chat.clearState();

            // Log outbound
            await db.query(
                `INSERT INTO chat_logs (user_id, contact_phone, body, direction)
                 VALUES (?, ?, ?, 'out')`,
                [userId, contact.phone, content]
            );

            sentCount++;
            console.log(`[CampaignRunner] Delivered to ${contact.phone}`);

        } catch (err) {
            success = false;
            failCount++;
            console.error(`[CampaignRunner] Delivery Failure for ${contact.phone}:`, err.message);

            // Detection: check for rate limiting or ban indicators in error message
            if (err.message.toLowerCase().includes('rate') || err.message.toLowerCase().includes('limit')) {
                rateLimitCooling = true;
            }
        }

        // 4. Progress Update
        io.to(room).emit('campaign_update', {
            campaignId,
            status: 'processing',
            progress: Math.round(((i + 1) / contacts.length) * 100),
            lastPhone: contact.phone,
            success: success,
            sentCount,
            failCount,
            total: contacts.length
        });

        // 5. Smart Delay between messages
        if (i < contacts.length - 1 && activeCampaigns.get(campaignId)) {
            const delay = getHumanDelay();
            console.log(`[Anti-Ban] Individual Delay: ${(delay / 1000).toFixed(1)}s`);
            await new Promise(r => setTimeout(r, delay));
        }
    }

    const isStopped = !activeCampaigns.get(campaignId);
    const finalStatus = isStopped ? 'failed' : (failCount === contacts.length ? 'failed' : 'completed');

    await db.query(
        `UPDATE campaigns SET status = ?, sent_count = ?, fail_count = ? WHERE id = ?`,
        [finalStatus, sentCount, failCount, campaignId]
    );

    io.to(room).emit('campaign_finished', {
        campaignId,
        status: finalStatus,
        sent: sentCount,
        failed: failCount,
        total: contacts.length,
        wasStopped: isStopped
    });

    activeCampaigns.delete(campaignId);
}

function stopCampaign(campaignId) {
    if (activeCampaigns.has(campaignId)) {
        activeCampaigns.set(campaignId, false);
        return true;
    }
    return false;
}

module.exports = { runCampaign, stopCampaign };
