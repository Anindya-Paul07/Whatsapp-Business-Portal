const db = require('../config/db');
const { formatToJID } = require('../utils/jid');
const { MessageMedia, Buttons } = require('whatsapp-web.js');
const path = require('path');
const fs = require('fs');
const SessionRotator = require('./SessionRotator');
const BanGuardService = require('./BanGuardService');

/** @type {Map<number, boolean>} campaignId -> isRunning */
const activeCampaigns = new Map();
/** @type {Set<number>} campaignIds paused after the current recipient */
const pausedCampaigns = new Set();
/** @type {Map<number, object>} campaignId -> latestUpdateData */
const liveProgress = new Map();

function getLiveProgress(campaignId) {
    return liveProgress.get(parseInt(campaignId, 10)) || null;
}

/**
 * Advanced Anti-Detection Helpers
 */
const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getHumanDelay = (minSeconds = 20, maxSeconds = 45) => randomBetween(minSeconds * 1000, maxSeconds * 1000);
const getDeepPause = (minMinutes = 5, maxMinutes = 10) => randomBetween(minMinutes * 60000, maxMinutes * 60000);

function categorizeFailure(err, context = {}) {
    const message = String(err?.message || '').toLowerCase();
    if (context.media && (message.includes('media') || message.includes('file'))) return 'media_failed';
    if (context.buttons && (message.includes('button') || message.includes('buttons'))) return 'button_unsupported';
    if (message.includes('not registered') || message.includes('invalid') || message.includes('wid')) return 'invalid_phone';
    if (message.includes('timeout') || message.includes('timed out')) return 'timeout';
    if (message.includes('not ready') || message.includes('disconnected') || message.includes('session')) return 'whatsapp_disconnected';
    if (message.includes('blacklist') || message.includes('blocked')) return 'blacklisted';
    return 'unknown_error';
}

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
async function getRecipientCounts(campaignId) {
    const [rows] = await db.query(
        `SELECT status, COUNT(*) AS count
           FROM campaign_recipients
          WHERE campaign_id = ?
       GROUP BY status`,
        [campaignId]
    );
    return rows.reduce((acc, row) => {
        acc[row.status] = row.count;
        return acc;
    }, { pending: 0, sent: 0, failed: 0, skipped: 0 });
}

async function updateCampaignCounts(campaignId, status = null) {
    const counts = await getRecipientCounts(campaignId);
    const total = counts.pending + counts.sent + counts.failed + counts.skipped;
    const progress = total === 0 ? 0 : Math.round(((counts.sent + counts.failed + counts.skipped) / total) * 100);

    await db.query(
        `UPDATE campaigns
            SET sent_count = ?, fail_count = ?, skipped_count = ?${status ? ', status = ?' : ''}
          WHERE id = ?`,
        status
            ? [counts.sent, counts.failed, counts.skipped, status, campaignId]
            : [counts.sent, counts.failed, counts.skipped, campaignId]
    );

    return { counts, total, progress };
}

async function runCampaign({ campaignId, userId, message, mediaUrl, buttons, contacts, client, io, batchLimit = 50, settings = {} }) {
    const room = `user_${userId}`;
    activeCampaigns.set(campaignId, true);
    pausedCampaigns.delete(campaignId);
    const safeBatchLimit = Math.max(parseInt(batchLimit || settings.batch_limit || 50, 10), 1);
    const delayMin = Math.max(parseInt(settings.delay_min_seconds || 20, 10), 1);
    const delayMax = Math.max(parseInt(settings.delay_max_seconds || 45, 10), delayMin);
    const deepPauseEvery = Math.max(parseInt(settings.deep_pause_every || 15, 10), 1);
    const deepPauseMin = Math.max(parseInt(settings.deep_pause_min_minutes || 5, 10), 1);
    const deepPauseMax = Math.max(parseInt(settings.deep_pause_max_minutes || 10, 10), deepPauseMin);
    const failurePauseThreshold = Math.max(parseInt(settings.failure_pause_threshold || 10, 10), 1);
    const initialCounts = await getRecipientCounts(campaignId);
    const totalRecipients = initialCounts.pending + initialCounts.sent + initialCounts.failed + initialCounts.skipped || contacts.length;
    liveProgress.set(campaignId, {
        campaignId,
        status: 'processing',
        progress: 0,
        sentCount: initialCounts.sent || 0,
        failCount: initialCounts.failed || 0,
        skippedCount: initialCounts.skipped || 0,
        total: totalRecipients
    });

    if (!isInsideSendWindow(settings.send_window_start, settings.send_window_end)) {
        await db.query(`UPDATE campaigns SET status = 'paused', paused_at = NOW() WHERE id = ?`, [campaignId]);
        const updateData = {
            campaignId,
            status: 'paused',
            progress: 0,
            sentCount: initialCounts.sent || 0,
            failCount: initialCounts.failed || 0,
            skippedCount: initialCounts.skipped || 0,
            total: totalRecipients,
            reason: 'Outside allowed send window'
        };
        liveProgress.set(campaignId, updateData);
        io.to(room).emit('campaign_update', updateData);
        activeCampaigns.delete(campaignId);
        return;
    }

    await db.query(`UPDATE campaigns SET status = 'processing', started_at = COALESCE(started_at, NOW()), paused_at = NULL WHERE id = ?`, [campaignId]);

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

    const contactsToRun = contacts.slice(0, safeBatchLimit);
    for (let i = 0; i < contactsToRun.length; i++) {
        // 1. Manual Stop Check
        if (!activeCampaigns.get(campaignId)) break;

        const contact = contactsToRun[i];

        // 2. Blacklist Check (Ban-Guard)
        const isBlacklisted = await BanGuardService.isBlacklisted(userId, contact.phone);
        if (isBlacklisted) {
            console.log(`[CampaignRunner] Skipping blacklisted number: ${contact.phone}`);
            if (contact.recipient_id) {
                await db.query(
                    `UPDATE campaign_recipients
                        SET status = 'skipped', failure_code = 'blacklisted', error_message = 'Blacklisted or blocked', sent_at = NULL
                      WHERE id = ?`,
                    [contact.recipient_id]
                );
            }
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
        if (i > 0 && i % deepPauseEvery === 0) {
            const pauseTime = getDeepPause(deepPauseMin, deepPauseMax);
            console.log(`[Anti-Ban] Deep Pause for ${(pauseTime / 60000).toFixed(1)} mins...`);
            io.to(room).emit('campaign_update', { campaignId, status: 'Deep Pause', progress: Math.round((i / contactsToRun.length) * 100) });
            await new Promise(r => setTimeout(r, pauseTime));
        }

        const chatId = formatToJID(contact.phone);

        // --- Content Preparation ---
        const content = parseDynamicContent(message, contact);

        const finalMessageStr = content;
        const normalizedButtons = Array.isArray(buttons)
            ? buttons
                .map(btn => ({ body: btn.text || btn.body || String(btn) }))
                .filter(btn => btn.body)
                .slice(0, 3)
            : [];

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

            if (normalizedButtons.length > 0) {
                const buttonMessage = media
                    ? new Buttons(media, normalizedButtons, finalMessageStr, '')
                    : new Buttons(finalMessageStr, normalizedButtons, '', '');
                await senderClient.sendMessage(chatId, buttonMessage);
            } else if (media) {
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

            console.log(`[CampaignRunner] Delivered to ${contact.phone}`);
            if (contact.recipient_id) {
                await db.query(
                    `UPDATE campaign_recipients
                        SET status = 'sent', failure_code = NULL, error_message = NULL, sent_at = NOW()
                      WHERE id = ?`,
                    [contact.recipient_id]
                );
            }

        } catch (err) {
            success = false;
            const failureCode = categorizeFailure(err, { media: !!media, buttons: normalizedButtons.length > 0 });
            console.error(`[CampaignRunner] Delivery Failure for ${contact.phone}:`, err.message);
            if (contact.recipient_id) {
                await db.query(
                    `UPDATE campaign_recipients
                        SET status = 'failed', failure_code = ?, error_message = ?, sent_at = NULL
                      WHERE id = ?`,
                    [failureCode, String(err.message || 'Delivery failed').slice(0, 1000), contact.recipient_id]
                );
            }

            // Report failure to BanGuard (Auto-Pause logic)
            if (sessionId) {
                await BanGuardService.reportFailure(sessionId);
            }
        }

        // 5. Progress Update
        const { counts, total, progress } = await updateCampaignCounts(campaignId);
        const updateData = {
            campaignId,
            status: 'processing',
            progress,
            lastPhone: contact.phone,
            lastName: contact.name,
            success: success,
            sentCount: counts.sent,
            failCount: counts.failed,
            skippedCount: counts.skipped,
            total
        };

        liveProgress.set(campaignId, updateData);
        io.to(room).emit('campaign_update', updateData);

        if (counts.failed >= failurePauseThreshold && counts.failed > counts.sent) {
            pausedCampaigns.add(campaignId);
            io.to(room).emit('campaign_update', {
                ...updateData,
                status: 'paused',
                reason: 'Failure threshold reached. Review failed recipients before resuming.'
            });
        }

        if (pausedCampaigns.has(campaignId)) break;

        // 6. Smart Delay between messages
        if (i < contactsToRun.length - 1 && activeCampaigns.get(campaignId)) {
            const delay = getHumanDelay(delayMin, delayMax);
            console.log(`[Anti-Ban] Delay: ${(delay / 1000).toFixed(1)}s`);
            await new Promise(r => setTimeout(r, delay));
        }
    }

    const isStopped = !activeCampaigns.get(campaignId);
    const isPaused = pausedCampaigns.has(campaignId);
    const finalCounts = await getRecipientCounts(campaignId);
    const hasPending = finalCounts.pending > 0;
    const finalStatus = isPaused ? 'paused' : (isStopped ? 'failed' : (hasPending ? 'paused' : (finalCounts.sent === 0 && finalCounts.failed > 0 ? 'failed' : 'completed')));

    await db.query(
        `UPDATE campaigns
            SET status = ?, sent_count = ?, fail_count = ?, skipped_count = ?,
                finished_at = CASE WHEN ? IN ('completed','failed') THEN NOW() ELSE finished_at END,
                paused_at = CASE WHEN ? = 'paused' THEN NOW() ELSE paused_at END
          WHERE id = ?`,
        [finalStatus, finalCounts.sent, finalCounts.failed, finalCounts.skipped, finalStatus, finalStatus, campaignId]
    );

    io.to(room).emit('campaign_finished', {
        campaignId,
        status: finalStatus,
        sent: finalCounts.sent,
        failed: finalCounts.failed,
        skipped: finalCounts.skipped,
        total: finalCounts.sent + finalCounts.failed + finalCounts.skipped + finalCounts.pending,
        wasStopped: isStopped,
        wasPaused: isPaused || finalStatus === 'paused'
    });

    activeCampaigns.delete(campaignId);
    pausedCampaigns.delete(campaignId);
    liveProgress.delete(campaignId);
}

function stopCampaign(campaignId) {
    if (activeCampaigns.has(campaignId)) {
        activeCampaigns.set(campaignId, false);
        return true;
    }
    return false;
}

function pauseCampaign(campaignId) {
    const id = parseInt(campaignId, 10);
    if (activeCampaigns.has(id)) {
        pausedCampaigns.add(id);
        return true;
    }
    return false;
}

module.exports = { runCampaign, stopCampaign, pauseCampaign, getLiveProgress, parseDynamicContent, categorizeFailure };
