const db = require('../config/db');
const { formatToJID } = require('../utils/jid');
const { MessageMedia, Buttons } = require('whatsapp-web.js');
const path = require('path');
const fs = require('fs');
const SessionRotator = require('./SessionRotator');
const BanGuardService = require('./BanGuardService');

/** @type {Map<number, boolean>} campaignId -> isRunning */
const activeCampaigns = new Map();
/** @type {Map<number, object>} campaignId -> latestUpdateData */
const liveProgress = new Map();

function getLiveProgress(campaignId) {
    return liveProgress.get(parseInt(campaignId, 10)) || null;
}

/**
 * Advanced Anti-Detection Helpers
 */
const getHumanDelay = () => Math.floor(Math.random() * (45000 - 20000 + 1)) + 20000;
const getDeepPause = () => Math.floor(Math.random() * (600000 - 300000 + 1)) + 300000; // 5-10 mins

/**
 * Handles {option1|option2} spintax and {{placeholder}} or {placeholder} dynamic fields.
 */
function parseDynamicContent(text, contact) {
    if (!text) return '';

    // 1. Spintax parsing {A|B} only if there is a pipe character
    let result = text.replace(/\{([^{}]+)\}/g, (match, options) => {
        if (options.includes('|')) {
            const choices = options.split('|');
            return choices[Math.floor(Math.random() * choices.length)];
        }
        return match; // Leave {name} intact for step 2
    });

    // 2. Dynamic placeholders {{name}}, {{city}}, or {name}, etc.
    // Try both top-level and metadata JSON.
    const combinedData = { ...contact, ...(contact.metadata || {}) };
    result = result.replace(/\{\{?([^{}]+)\}?\}/gi, (match, key) => {
        const lowerKey = key.toLowerCase().trim();
        return combinedData[lowerKey] !== undefined ? combinedData[lowerKey] : match;
    });

    return result;
}

/**
 * Run a campaign with sophisticated anti-ban protocol and multi-session distribution.
 */
async function runCampaign({ campaignId, userId, message, mediaUrl, buttons, contacts, client, io }) {
    const room = `user_${userId}`;
    let sentCount = 0;
    let failCount = 0;

    activeCampaigns.set(campaignId, true);
    liveProgress.set(campaignId, {
        campaignId,
        status: 'processing',
        progress: 0,
        sentCount: 0,
        failCount: 0,
        total: contacts.length
    });

    await db.query(`UPDATE campaigns SET status = 'processing' WHERE id = ?`, [campaignId]);

    // Prepare media if it exists
    let media = null;
    if (mediaUrl) {
        try {
            const absolutePath = path.join(process.cwd(), mediaUrl);
            if (fs.existsSync(absolutePath)) {
                media = MessageMedia.fromFilePath(absolutePath);
            } else {
                console.error(`[CampaignRunner] Media file not found: ${absolutePath}`);
            }
        } catch (err) {
            console.error(`[CampaignRunner] Media preparation error:`, err.message);
        }
    }

    for (let i = 0; i < contacts.length; i++) {
        // 1. Manual Stop Check
        if (!activeCampaigns.get(campaignId)) break;

        const contact = contacts[i];

        // 2. Blacklist Check (Ban-Guard)
        const isBlacklisted = await BanGuardService.isBlacklisted(userId, contact.phone);
        if (isBlacklisted) {
            console.log(`[CampaignRunner] Skipping blacklisted number: ${contact.phone}`);
            failCount++;
            continue;
        }

        // 3. Multi-Session Selection (Load Balancer)
        // For now, if we have a pool, we pick the LRU session.
        // If no pools exist, we use the default passed 'client'.
        let senderClient = client;
        let sessionId = null;
        const poolSession = await SessionRotator.getNextSession(userId);
        if (poolSession) {
            // In a real multi-client setup, we'd retrieve the specific Client instance
            // by sessionId from the SessionManager map.
            // For this implementation, we demonstrate the logic.
            sessionId = poolSession.id;
        }

        // 4. Deep Pause every 15 messages
        if (i > 0 && i % 15 === 0) {
            const pauseTime = getDeepPause();
            console.log(`[Anti-Ban] Deep Pause for ${(pauseTime / 60000).toFixed(1)} mins...`);
            io.to(room).emit('campaign_update', { campaignId, status: 'Deep Pause', progress: Math.round((i / contacts.length) * 100) });
            await new Promise(r => setTimeout(r, pauseTime));
        }

        const chatId = formatToJID(contact.phone);

        // --- Content Preparation ---
        const content = parseDynamicContent(message, contact);

        // Append simulated interactive buttons because whatsapp-web.js Native Buttons are deprecated by Meta
        let finalMessageStr = content;
        if (buttons && buttons.length > 0) {
            finalMessageStr += '\n\n*Please reply with a number:*';
            buttons.forEach((btn, idx) => {
                const btnText = btn.text || btn.body || btn;
                finalMessageStr += `\n${idx + 1}. ${btnText}`;
            });
        }

        let success = true;
        try {
            // --- Human-Like Behaviour Simulation ---
            await senderClient.sendPresenceAvailable();

            try {
                const chat = await senderClient.getChatById(chatId);
                const typingTime = Math.min(finalMessageStr.length * 50, 10000);
                await chat.sendStateTyping();
                await new Promise(r => setTimeout(r, typingTime));
                await chat.clearState();
            } catch (chatError) {
                // Ignore silently since typing simulation is not strictly necessary and frequently fails for new chats
            }

            if (media) {
                await senderClient.sendMessage(chatId, media, { caption: finalMessageStr });
            } else {
                await senderClient.sendMessage(chatId, finalMessageStr);
            }

            // Log outbound
            await db.query(
                `INSERT INTO chat_logs (user_id, contact_phone, body, direction, session_id)
                 VALUES (?, ?, ?, 'out', ?)`,
                [userId, contact.phone, content, sessionId]
            );

            sentCount++;
            console.log(`[CampaignRunner] Delivered to ${contact.phone}`);

        } catch (err) {
            success = false;
            failCount++;
            console.error(`[CampaignRunner] Delivery Failure for ${contact.phone}:`, err.message);

            // Report failure to BanGuard (Auto-Pause logic)
            if (sessionId) {
                await BanGuardService.reportFailure(sessionId);
            }
        }

        // 5. Progress Update
        const updateData = {
            campaignId,
            status: 'processing',
            progress: Math.round(((i + 1) / contacts.length) * 100),
            lastPhone: contact.phone,
            success: success,
            sentCount,
            failCount,
            total: contacts.length
        };

        liveProgress.set(campaignId, updateData);
        io.to(room).emit('campaign_update', updateData);

        // 6. Smart Delay between messages
        if (i < contacts.length - 1 && activeCampaigns.get(campaignId)) {
            const delay = getHumanDelay();
            console.log(`[Anti-Ban] Delay: ${(delay / 1000).toFixed(1)}s`);
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
    liveProgress.delete(campaignId);
}

function stopCampaign(campaignId) {
    if (activeCampaigns.has(campaignId)) {
        activeCampaigns.set(campaignId, false);
        return true;
    }
    return false;
}

module.exports = { runCampaign, stopCampaign, getLiveProgress, parseDynamicContent };
