const express = require('express');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { runCampaign, stopCampaign, pauseCampaign, getLiveProgress } = require('../services/CampaignRunner');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        const dir = 'uploads/campaigns';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'campaign-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });
const csvUpload = multer({ dest: 'uploads/' });

function toCsv(rows) {
    if (!rows.length) return '';
    const header = Object.keys(rows[0]);
    const lines = rows.map(row => header.map(key => `"${String(row[key] ?? '').replace(/"/g, '""')}"`).join(','));
    return [header.join(','), ...lines].join('\n');
}

function toExcelXml(rows, sheetName = 'Report') {
    const header = rows.length ? Object.keys(rows[0]) : [];
    const xmlEscape = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const headerCells = header.map(column => `<Cell><Data ss:Type="String">${xmlEscape(column)}</Data></Cell>`).join('');
    const rowCells = rows.map(row => `<Row>${header.map(key => `<Cell><Data ss:Type="String">${xmlEscape(row[key])}</Data></Cell>`).join('')}</Row>`).join('');
    return `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="${xmlEscape(sheetName)}">
<Table>
<Row>${headerCells}</Row>
${rowCells}
</Table>
</Worksheet>
</Workbook>`;
}

function buildPdf(title, rows) {
    const escapePdfText = (text) => String(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    const fitText = (text, width, fontSize = 9) => {
        const raw = String(text ?? '');
        const maxChars = Math.max(Math.floor(width / (fontSize * 0.52)) - 1, 1);
        if (raw.length <= maxChars) return raw;
        if (maxChars <= 3) return raw.slice(0, maxChars);
        return `${raw.slice(0, maxChars - 3)}...`;
    };
    const formatHeader = (key) => String(key || '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());

    const pageLeft = 30;
    const pageRight = 582;
    const tableWidth = pageRight - pageLeft;
    const titleY = 805;
    const tableTopY = 770;
    const rowHeight = 22;
    const bottomY = 70;

    const keys = rows.length ? Object.keys(rows[0]) : ['status'];
    const maxColumns = 6;
    const displayKeys = keys.slice(0, maxColumns);
    const omittedColumns = Math.max(keys.length - displayKeys.length, 0);

    const maxDataRows = Math.max(Math.floor((tableTopY - bottomY - rowHeight) / rowHeight), 1);
    const displayRows = rows.slice(0, maxDataRows);
    const omittedRows = Math.max(rows.length - displayRows.length, 0);

    const colCount = displayKeys.length || 1;
    const baseWidth = Math.floor(tableWidth / colCount);
    const colWidths = Array(colCount).fill(baseWidth);
    colWidths[colCount - 1] += tableWidth - (baseWidth * colCount);

    const colStarts = [];
    let xCursor = pageLeft;
    for (const width of colWidths) {
        colStarts.push(xCursor);
        xCursor += width;
    }

    const lastRowIndex = displayRows.length + 1;
    const tableBottomY = tableTopY - (lastRowIndex * rowHeight);

    const drawOps = [];
    const textOps = [];

    const drawLine = (x1, y1, x2, y2) => drawOps.push(`${x1} ${y1} m ${x2} ${y2} l S`);
    drawOps.push('0.8 w');
    drawLine(pageLeft, tableTopY, pageRight, tableTopY);
    for (let i = 1; i <= lastRowIndex; i++) {
        const y = tableTopY - (i * rowHeight);
        drawLine(pageLeft, y, pageRight, y);
    }
    for (let i = 0; i <= colCount; i++) {
        const x = i === colCount ? pageRight : colStarts[i];
        drawLine(x, tableTopY, x, tableBottomY);
    }

    textOps.push(`1 0 0 1 ${pageLeft} ${titleY} Tm (${escapePdfText(fitText(title, 420, 13))}) Tj`);
    textOps.push(`1 0 0 1 ${pageRight - 120} ${titleY} Tm (Rows: ${rows.length}) Tj`);

    if (!rows.length) {
        textOps.push(`1 0 0 1 ${pageLeft + 6} ${tableTopY - 16} Tm (No data available) Tj`);
    } else {
        displayKeys.forEach((key, idx) => {
            const text = fitText(formatHeader(key), colWidths[idx] - 10, 9);
            const tx = colStarts[idx] + 5;
            const ty = tableTopY - 15;
            textOps.push(`1 0 0 1 ${tx} ${ty} Tm (${escapePdfText(text)}) Tj`);
        });

        displayRows.forEach((row, rowIndex) => {
            displayKeys.forEach((key, colIndex) => {
                const value = row[key];
                const text = fitText(value, colWidths[colIndex] - 10, 8.5);
                const tx = colStarts[colIndex] + 5;
                const ty = tableTopY - ((rowIndex + 2) * rowHeight) + 7;
                textOps.push(`1 0 0 1 ${tx} ${ty} Tm (${escapePdfText(text)}) Tj`);
            });
        });
    }

    if (omittedRows > 0) {
        textOps.push(`1 0 0 1 ${pageLeft} ${tableBottomY - 20} Tm (${escapePdfText(`${omittedRows} more row(s) omitted`)}) Tj`);
    }
    if (omittedColumns > 0) {
        textOps.push(`1 0 0 1 ${pageLeft} ${tableBottomY - 36} Tm (${escapePdfText(`${omittedColumns} more column(s) omitted`)}) Tj`);
    }

    const content = `q
${drawOps.join('\n')}
Q
BT
/F1 13 Tf
${textOps[0] || ''}
/F1 9 Tf
${textOps.slice(1).join('\n')}
ET`;

    const objects = [];
    const pushObj = (obj) => {
        objects.push(obj);
    };
    pushObj('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    pushObj('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
    pushObj('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n');
    pushObj('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');
    pushObj(`5 0 obj\n<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream\nendobj\n`);

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach(obj => {
        offsets.push(Buffer.byteLength(pdf, 'utf8'));
        pdf += obj;
    });
    const xrefStart = Buffer.byteLength(pdf, 'utf8');
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i < offsets.length; i++) {
        pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
    return Buffer.from(pdf, 'utf8');
}

function sendReport(res, format, filenameBase, rows, title) {
    if (format === 'excel') {
        const xml = toExcelXml(rows, filenameBase);
        res.setHeader('Content-Type', 'application/vnd.ms-excel');
        res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.xls"`);
        return res.send(xml);
    }
    if (format === 'pdf') {
        const pdfBuffer = buildPdf(title, rows);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.pdf"`);
        return res.send(pdfBuffer);
    }
    const csvContent = toCsv(rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.csv"`);
    return res.send(csvContent);
}

function normalizePhone(value) {
    return String(value || '').replace(/\D/g, '');
}

function safeJson(value, fallback = null) {
    if (!value) return fallback;
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch (_) { return fallback; }
}

function splitLabels(labels) {
    if (Array.isArray(labels)) return labels.map(l => String(l).trim()).filter(Boolean);
    return String(labels || '').split(',').map(l => l.trim()).filter(Boolean);
}

function parseCsvContacts(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', data => {
                const name = data.name || data.Name || data.contact_name || '';
                const phone = normalizePhone(data.phone || data.Phone || data.number || data.whatsapp_number);
                const labels = data.labels || data.Labels || '';
                if (phone) results.push({ name, phone, labels, do_not_message: 0 });
            })
            .on('end', () => resolve(results))
            .on('error', reject);
    });
}

async function buildLegacyRecipientFallbackRows(campaign, userId) {
    const snapshot = safeJson(campaign.audience_snapshot_json, {});
    const rows = [];

    if (Array.isArray(snapshot?.contacts) && snapshot.contacts.length > 0) {
        snapshot.contacts.forEach(contact => {
            const phone = normalizePhone(contact.phone);
            if (!phone) return;
            rows.push({
                name: contact.name || '',
                phone,
                status: 'unknown',
                failure_code: null,
                error_message: 'Legacy campaign data without per-recipient status',
                sent_at: null,
                created_at: campaign.created_at || null
            });
        });
    } else if (Array.isArray(snapshot?.contactIds) && snapshot.contactIds.length > 0) {
        const [contacts] = await db.query(
            `SELECT name, phone
               FROM contacts
              WHERE user_id = ? AND id IN (?)`,
            [userId, snapshot.contactIds]
        );
        contacts.forEach(contact => {
            rows.push({
                name: contact.name || '',
                phone: contact.phone,
                status: 'unknown',
                failure_code: null,
                error_message: 'Legacy campaign data without per-recipient status',
                sent_at: null,
                created_at: campaign.created_at || null
            });
        });
    }

    if (rows.length > 0) {
        return rows;
    }

    const sent = Math.max(parseInt(campaign.sent_count || 0, 10), 0);
    const failed = Math.max(parseInt(campaign.fail_count || 0, 10), 0);
    const skipped = Math.max(parseInt(campaign.skipped_count || 0, 10), 0);
    const total = sent + failed + skipped;
    if (total === 0) return [];

    const summaryRows = [];
    for (let i = 0; i < sent; i++) {
        summaryRows.push({
            name: `Delivered recipient ${i + 1}`,
            phone: '',
            status: 'sent',
            failure_code: null,
            error_message: 'Legacy campaign summary row',
            sent_at: null,
            created_at: campaign.created_at || null
        });
    }
    for (let i = 0; i < failed; i++) {
        summaryRows.push({
            name: `Failed recipient ${i + 1}`,
            phone: '',
            status: 'failed',
            failure_code: 'legacy_summary',
            error_message: 'Legacy campaign summary row',
            sent_at: null,
            created_at: campaign.created_at || null
        });
    }
    for (let i = 0; i < skipped; i++) {
        summaryRows.push({
            name: `Skipped recipient ${i + 1}`,
            phone: '',
            status: 'skipped',
            failure_code: 'legacy_summary',
            error_message: 'Legacy campaign summary row',
            sent_at: null,
            created_at: campaign.created_at || null
        });
    }
    return summaryRows;
}

async function resolveAudience(userId, audience = {}) {
    const type = audience.type || audience.audience_type;
    let contacts = [];

    if (type === 'selected_contacts') {
        const ids = Array.isArray(audience.contactIds) ? audience.contactIds : [];
        if (ids.length > 0) {
            const [rows] = await db.query(
                `SELECT id AS contact_id, name, phone, labels, do_not_message, consent_status
                   FROM contacts
                  WHERE user_id = ? AND id IN (?)`,
                [userId, ids]
            );
            contacts = rows;
        }
    } else if (type === 'label_filter') {
        const labels = splitLabels(audience.labels);
        if (labels.length > 0) {
            const where = labels.map(() => 'LOWER(COALESCE(labels, "")) LIKE ?').join(' AND ');
            const params = labels.map(label => `%${label.toLowerCase()}%`);
            const [rows] = await db.query(
                `SELECT id AS contact_id, name, phone, labels, do_not_message, consent_status
                   FROM contacts
                  WHERE user_id = ? AND ${where}`,
                [userId, ...params]
            );
            contacts = rows;
        }
    } else if (type === 'all_contacts') {
        const [rows] = await db.query(
            `SELECT id AS contact_id, name, phone, labels, do_not_message, consent_status
               FROM contacts
              WHERE user_id = ?`,
            [userId]
        );
        contacts = rows;
    } else if (type === 'csv_upload') {
        contacts = Array.isArray(audience.contacts) ? audience.contacts.map(row => ({
            contact_id: null,
            name: row.name || '',
            phone: normalizePhone(row.phone),
            labels: row.labels || '',
            do_not_message: row.do_not_message || row.consent_status === 'do_not_message' ? 1 : 0,
            consent_status: row.consent_status || (row.do_not_message ? 'do_not_message' : 'unknown')
        })).filter(row => row.phone) : [];
    }

    const excluded = new Set((audience.excludeContactIds || []).map(id => String(id)));
    const seen = new Set();
    const unique = [];

    for (const contact of contacts) {
        if (contact.contact_id && excluded.has(String(contact.contact_id))) continue;
        if (seen.has(contact.phone)) continue;
        seen.add(contact.phone);
        unique.push(contact);
    }

    return { type, contacts: unique };
}

async function insertCampaignRecipients(campaignId, contacts) {
    if (!contacts.length) return;

    const values = contacts.map(contact => [
        campaignId,
        contact.contact_id || null,
        contact.name || '',
        contact.phone,
        contact.do_not_message ? 'skipped' : 'pending',
        contact.do_not_message ? 'do_not_message' : null,
        contact.do_not_message ? 'Marked as do not message' : null
    ]);

    await db.query(
        `INSERT INTO campaign_recipients
            (campaign_id, contact_id, name, phone, status, failure_code, error_message)
         VALUES ?`,
        [values]
    );
}

async function loadCampaignForRun(campaignId, userId) {
    const [[campaign]] = await db.query(
        `SELECT c.*, t.message AS template_message, t.media_url AS template_media_url, t.buttons
           FROM campaigns c
           LEFT JOIN message_templates t ON c.template_id = t.id
          WHERE c.id = ? AND c.user_id = ?
          LIMIT 1`,
        [campaignId, userId]
    );
    return campaign;
}

async function getRunnableRecipients(campaignId, statuses = ['pending']) {
    await db.query(
        `UPDATE campaign_recipients cr
          JOIN contacts c ON c.id = cr.contact_id
           SET cr.status = 'skipped',
               cr.failure_code = 'do_not_message',
               cr.error_message = 'Marked as do not message'
         WHERE cr.campaign_id = ? AND cr.status = 'pending' AND c.do_not_message = 1`,
        [campaignId]
    );

    const [rows] = await db.query(
        `SELECT id AS recipient_id, contact_id, name, phone, status
           FROM campaign_recipients
          WHERE campaign_id = ? AND status IN (?)
          ORDER BY id ASC`,
        [campaignId, statuses]
    );
    return rows;
}

module.exports = function createCampaignRoutes(sessionManager, io) {
    const router = express.Router();

    router.get('/', authMiddleware, async (req, res) => {
        try {
            const [rows] = await db.query(
                `SELECT c.id, c.name, c.message, c.template_id, c.audience_type,
                        c.scheduled_at, c.started_at, c.finished_at, c.paused_at, c.batch_limit,
                        c.delay_min_seconds, c.delay_max_seconds, c.deep_pause_every,
                        c.deep_pause_min_minutes, c.deep_pause_max_minutes,
                        c.send_window_start, c.send_window_end, c.failure_pause_threshold,
                        c.status, c.sent_count, c.fail_count, c.skipped_count, c.created_at,
                        GREATEST(COUNT(cr.id), COALESCE(c.sent_count, 0) + COALESCE(c.fail_count, 0) + COALESCE(c.skipped_count, 0)) AS recipient_count
                   FROM campaigns c
              LEFT JOIN campaign_recipients cr ON cr.campaign_id = c.id
                  WHERE c.user_id = ?
               GROUP BY c.id
               ORDER BY c.created_at DESC`,
                [req.user.id]
            );

            const augmented = rows.map(c => {
                if (c.status === 'processing') {
                    const live = getLiveProgress(c.id);
                    return live ? { ...c, ...live } : c;
                }
                return c;
            });

            return res.json({ success: true, campaigns: augmented });
        } catch (err) {
            console.error('[Campaigns] List error:', err.message);
            return res.status(500).json({ success: false, message: 'Server error' });
        }
    });

    router.get('/reports/export', authMiddleware, async (req, res) => {
        const format = ['csv', 'excel', 'pdf'].includes(String(req.query.format || '').toLowerCase())
            ? String(req.query.format || '').toLowerCase()
            : 'csv';
        try {
            const [rows] = await db.query(
                `SELECT c.id AS campaign_id, c.name AS campaign_name, c.status, c.scheduled_at, c.started_at, c.finished_at,
                        c.sent_count, c.fail_count, c.skipped_count, c.created_at,
                        GREATEST(COUNT(cr.id), COALESCE(c.sent_count, 0) + COALESCE(c.fail_count, 0) + COALESCE(c.skipped_count, 0)) AS recipient_count
                   FROM campaigns c
              LEFT JOIN campaign_recipients cr ON cr.campaign_id = c.id
                  WHERE c.user_id = ?
               GROUP BY c.id
               ORDER BY c.created_at DESC`,
                [req.user.id]
            );
            return sendReport(res, format, `campaign-history-${req.user.id}`, rows, 'Campaign History Report');
        } catch (err) {
            console.error('[Campaigns] Export all report error:', err.message);
            return res.status(500).json({ success: false, message: 'Server error' });
        }
    });

    router.get('/:id', authMiddleware, async (req, res) => {
        try {
            const [[campaign]] = await db.query(
                `SELECT c.*, t.name AS template_name, t.message AS template_message, t.media_url AS template_media_url, t.buttons,
                        GREATEST(COUNT(cr.id), COALESCE(c.sent_count, 0) + COALESCE(c.fail_count, 0) + COALESCE(c.skipped_count, 0)) AS recipient_count
                   FROM campaigns c
              LEFT JOIN message_templates t ON c.template_id = t.id
              LEFT JOIN campaign_recipients cr ON cr.campaign_id = c.id
                  WHERE c.id = ? AND c.user_id = ?
               GROUP BY c.id
                  LIMIT 1`,
                [req.params.id, req.user.id]
            );
            if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });

            const live = campaign.status === 'processing' ? getLiveProgress(campaign.id) : null;
            return res.json({ success: true, campaign: live ? { ...campaign, ...live } : campaign });
        } catch (err) {
            console.error('[Campaigns] Detail error:', err.message);
            return res.status(500).json({ success: false, message: 'Server error' });
        }
    });

    router.post('/', authMiddleware, upload.single('media'), async (req, res) => {
        const name = req.body.name;
        const templateId = req.body.template_id || null;
        const oneTimeMessage = req.body.message || '';
        const scheduledAt = req.body.scheduled_at || null;
        const batchLimit = Math.max(parseInt(req.body.batch_limit || '50', 10), 1);
        const delayMin = Math.max(parseInt(req.body.delay_min_seconds || '20', 10), 1);
        const delayMax = Math.max(parseInt(req.body.delay_max_seconds || '45', 10), delayMin);
        const deepPauseEvery = Math.max(parseInt(req.body.deep_pause_every || '15', 10), 1);
        const deepPauseMin = Math.max(parseInt(req.body.deep_pause_min_minutes || '5', 10), 1);
        const deepPauseMax = Math.max(parseInt(req.body.deep_pause_max_minutes || '10', 10), deepPauseMin);
        const sendWindowStart = req.body.send_window_start || '10:00:00';
        const sendWindowEnd = req.body.send_window_end || '20:00:00';
        const failurePauseThreshold = Math.max(parseInt(req.body.failure_pause_threshold || '10', 10), 1);
        const audience = safeJson(req.body.audience, req.body.audience || {});
        const mediaUrl = req.file ? `uploads/campaigns/${req.file.filename}` : null;

        if (!name) {
            return res.status(400).json({ success: false, message: 'Campaign name is required' });
        }
        if (!templateId && !oneTimeMessage.trim()) {
            return res.status(400).json({ success: false, message: 'Select a template or write a message' });
        }
        if (!audience?.type) {
            return res.status(400).json({ success: false, message: 'Choose a campaign audience' });
        }

        try {
            const resolved = await resolveAudience(req.user.id, audience);
            if (resolved.contacts.length === 0) {
                return res.status(400).json({ success: false, message: 'No recipients found for this audience' });
            }

            const [result] = await db.query(
                `INSERT INTO campaigns
                    (user_id, name, template_id, message, media_url, audience_type, audience_snapshot_json,
                     scheduled_at, batch_limit, delay_min_seconds, delay_max_seconds, deep_pause_every,
                     deep_pause_min_minutes, deep_pause_max_minutes, send_window_start, send_window_end,
                     failure_pause_threshold, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
                [
                    req.user.id,
                    name,
                    templateId,
                    oneTimeMessage,
                    mediaUrl,
                    resolved.type,
                    JSON.stringify({ ...audience, contacts: resolved.contacts }),
                    scheduledAt || null,
                    batchLimit,
                    delayMin,
                    delayMax,
                    deepPauseEvery,
                    deepPauseMin,
                    deepPauseMax,
                    sendWindowStart,
                    sendWindowEnd,
                    failurePauseThreshold
                ]
            );

            await insertCampaignRecipients(result.insertId, resolved.contacts);
            const skippedCount = resolved.contacts.filter(c => c.do_not_message).length;
            if (skippedCount > 0) {
                await db.query(
                    `UPDATE campaigns SET skipped_count = ? WHERE id = ?`,
                    [skippedCount, result.insertId]
                );
            }

            return res.status(201).json({
                success: true,
                campaignId: result.insertId,
                recipientCount: resolved.contacts.length,
                skippedCount
            });
        } catch (err) {
            console.error('[Campaigns] Create error:', err.message);
            if (req.file) fs.unlink(req.file.path, () => { });
            return res.status(500).json({ success: false, message: 'Server error' });
        }
    });

    router.post('/:id/run', authMiddleware, csvUpload.single('file'), async (req, res) => {
        const userId = req.user.id;
        const campaignId = parseInt(req.params.id, 10);

        try {
            const campaign = await loadCampaignForRun(campaignId, userId);
            if (!campaign) {
                return res.status(404).json({ success: false, message: 'Campaign not found' });
            }
            if (campaign.status === 'processing') {
                return res.status(409).json({ success: false, message: 'Campaign is already running' });
            }
            if (!sessionManager.isReady(userId)) {
                return res.status(400).json({ success: false, message: 'WhatsApp session not ready.' });
            }

            if (req.body.fromSource === 'csv' && req.file) {
                const contacts = await parseCsvContacts(req.file.path);
                await db.query(`DELETE FROM campaign_recipients WHERE campaign_id = ?`, [campaignId]);
                await insertCampaignRecipients(campaignId, contacts);
                await db.query(
                    `UPDATE campaigns SET audience_type = 'csv_upload', audience_snapshot_json = ?, skipped_count = 0 WHERE id = ?`,
                    [JSON.stringify({ type: 'csv_upload', contacts }), campaignId]
                );
            } else if (req.body.audience) {
                const override = safeJson(req.body.audience, {});
                const resolved = await resolveAudience(userId, override);
                await db.query(`DELETE FROM campaign_recipients WHERE campaign_id = ?`, [campaignId]);
                await insertCampaignRecipients(campaignId, resolved.contacts);
                await db.query(
                    `UPDATE campaigns SET audience_type = ?, audience_snapshot_json = ?, skipped_count = ? WHERE id = ?`,
                    [
                        resolved.type,
                        JSON.stringify({ ...override, contacts: resolved.contacts }),
                        resolved.contacts.filter(c => c.do_not_message).length,
                        campaignId
                    ]
                );
            }

            const contacts = await getRunnableRecipients(campaignId, ['pending']);
            if (contacts.length === 0) {
                return res.status(400).json({ success: false, message: 'No pending recipients available' });
            }

            const client = sessionManager.getOrCreateSession(userId);
            const buttons = safeJson(campaign.buttons, []);

            runCampaign({
                campaignId,
                userId,
                message: campaign.template_message || campaign.message,
                mediaUrl: campaign.template_media_url || campaign.media_url,
                buttons,
                contacts,
                client,
                io,
                batchLimit: campaign.batch_limit || 50,
                settings: campaign
            }).catch(err => console.error('[Campaigns] Runner error:', err.message));

            return res.json({ success: true, message: `Campaign started with ${contacts.length} contacts.` });
        } catch (err) {
            console.error('[Campaigns] Run error:', err.message);
            return res.status(500).json({ success: false, message: err.message || 'Server error' });
        } finally {
            if (req.file) fs.unlink(req.file.path, () => { });
        }
    });

    router.post('/:id/stop', authMiddleware, async (req, res) => {
        const campaignId = parseInt(req.params.id, 10);
        const [[campaign]] = await db.query(
            `SELECT id FROM campaigns WHERE id = ? AND user_id = ? LIMIT 1`,
            [campaignId, req.user.id]
        );

        if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
        const stopped = stopCampaign(campaignId);
        if (stopped) return res.json({ success: true, message: 'Campaign stop signal sent.' });
        return res.status(400).json({ success: false, message: 'Campaign is not running.' });
    });

    router.post('/:id/pause', authMiddleware, async (req, res) => {
        const campaignId = parseInt(req.params.id, 10);
        const [[campaign]] = await db.query(
            `SELECT id, status FROM campaigns WHERE id = ? AND user_id = ? LIMIT 1`,
            [campaignId, req.user.id]
        );

        if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
        const paused = pauseCampaign(campaignId);
        if (!paused && campaign.status !== 'processing') {
            return res.status(400).json({ success: false, message: 'Campaign is not running.' });
        }
        await db.query(`UPDATE campaigns SET status = 'paused', paused_at = NOW() WHERE id = ? AND user_id = ?`, [campaignId, req.user.id]);
        return res.json({ success: true, message: 'Campaign pause signal sent.' });
    });

    router.post('/:id/resume', authMiddleware, async (req, res) => {
        const campaignId = parseInt(req.params.id, 10);
        const userId = req.user.id;

        try {
            const campaign = await loadCampaignForRun(campaignId, userId);
            if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
            if (!['paused', 'pending', 'failed'].includes(campaign.status)) {
                return res.status(409).json({ success: false, message: 'Only paused, pending, or failed campaigns can resume.' });
            }
            if (!sessionManager.isReady(userId)) {
                return res.status(400).json({ success: false, message: 'WhatsApp session not ready.' });
            }

            const contacts = await getRunnableRecipients(campaignId, ['pending']);
            if (contacts.length === 0) {
                return res.status(400).json({ success: false, message: 'No pending recipients available' });
            }

            runCampaign({
                campaignId,
                userId,
                message: campaign.template_message || campaign.message,
                mediaUrl: campaign.template_media_url || campaign.media_url,
                buttons: safeJson(campaign.buttons, []),
                contacts,
                client: sessionManager.getOrCreateSession(userId),
                io,
                batchLimit: campaign.batch_limit || 50,
                settings: campaign
            }).catch(err => console.error('[Campaigns] Resume runner error:', err.message));

            return res.json({ success: true, message: `Campaign resumed with ${contacts.length} pending recipients.` });
        } catch (err) {
            console.error('[Campaigns] Resume error:', err.message);
            return res.status(500).json({ success: false, message: 'Server error' });
        }
    });

    router.post('/:id/retry-failed', authMiddleware, async (req, res) => {
        const campaignId = parseInt(req.params.id, 10);
        const userId = req.user.id;

        try {
            const campaign = await loadCampaignForRun(campaignId, userId);
            if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
            if (!sessionManager.isReady(userId)) {
                return res.status(400).json({ success: false, message: 'WhatsApp session not ready.' });
            }

            await db.query(
                `UPDATE campaign_recipients
                    SET status = 'pending', failure_code = NULL, error_message = NULL, sent_at = NULL
                  WHERE campaign_id = ? AND status = 'failed'`,
                [campaignId]
            );

            const contacts = await getRunnableRecipients(campaignId, ['pending']);
            if (contacts.length === 0) {
                return res.status(400).json({ success: false, message: 'No failed recipients to retry' });
            }

            runCampaign({
                campaignId,
                userId,
                message: campaign.template_message || campaign.message,
                mediaUrl: campaign.template_media_url || campaign.media_url,
                buttons: safeJson(campaign.buttons, []),
                contacts,
                client: sessionManager.getOrCreateSession(userId),
                io,
                batchLimit: campaign.batch_limit || 50,
                settings: campaign,
                retry: true
            }).catch(err => console.error('[Campaigns] Retry runner error:', err.message));

            return res.json({ success: true, message: `Retry started for ${contacts.length} recipients.` });
        } catch (err) {
            console.error('[Campaigns] Retry error:', err.message);
            return res.status(500).json({ success: false, message: 'Server error' });
        }
    });

    router.get('/:id/recipients', authMiddleware, async (req, res) => {
        try {
            const [[campaign]] = await db.query(
                `SELECT id, audience_snapshot_json, sent_count, fail_count, skipped_count, created_at
                   FROM campaigns
                  WHERE id = ? AND user_id = ?
                  LIMIT 1`,
                [req.params.id, req.user.id]
            );
            if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });

            const [rows] = await db.query(
                `SELECT id, contact_id, name, phone, status, failure_code, error_message, sent_at, created_at
                   FROM campaign_recipients
                  WHERE campaign_id = ?
                  ORDER BY id ASC`,
                [req.params.id]
            );
            if (rows.length > 0) {
                return res.json({ success: true, recipients: rows });
            }

            const fallbackRows = await buildLegacyRecipientFallbackRows(campaign, req.user.id);
            return res.json({ success: true, recipients: fallbackRows });
        } catch (err) {
            console.error('[Campaigns] Recipients error:', err.message);
            return res.status(500).json({ success: false, message: 'Server error' });
        }
    });

    router.get('/:id/report', authMiddleware, async (req, res) => {
        const campaignId = parseInt(req.params.id, 10);
        const format = ['csv', 'excel', 'pdf'].includes(String(req.query.format || '').toLowerCase())
            ? String(req.query.format || '').toLowerCase()
            : 'csv';
        try {
            const [[campaign]] = await db.query(
                `SELECT id, name, audience_snapshot_json, sent_count, fail_count, skipped_count, created_at
                   FROM campaigns
                  WHERE id = ? AND user_id = ?
                  LIMIT 1`,
                [campaignId, req.user.id]
            );
            if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });

            const [rows] = await db.query(
                `SELECT name, phone, status, failure_code, error_message, sent_at, created_at
                   FROM campaign_recipients
                  WHERE campaign_id = ?
                  ORDER BY id ASC`,
                [campaignId]
            );
            const reportRows = rows.length > 0 ? rows : await buildLegacyRecipientFallbackRows(campaign, req.user.id);
            return sendReport(res, format, `campaign-${campaignId}-report`, reportRows, `${campaign.name} Recipient Report`);
        } catch (err) {
            console.error('[Campaigns] Campaign report error:', err.message);
            return res.status(500).json({ success: false, message: 'Server error' });
        }
    });

    router.put('/:id', authMiddleware, async (req, res) => {
        const { name, template_id, scheduled_at } = req.body;

        try {
            const [result] = await db.query(
                `UPDATE campaigns
                    SET name = ?, template_id = ?, scheduled_at = ?
                  WHERE id = ? AND user_id = ? AND status = 'pending'`,
                [name, template_id || null, scheduled_at || null, req.params.id, req.user.id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, message: 'Pending campaign not found' });
            }
            return res.json({ success: true, message: 'Campaign updated' });
        } catch (err) {
            console.error('[Campaigns] Update error:', err.message);
            return res.status(500).json({ success: false, message: 'Server error' });
        }
    });

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
