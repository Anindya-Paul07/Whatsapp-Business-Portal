const express = require('express');
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const upload = multer({
    dest: path.resolve('./uploads'),
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are accepted'), false);
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 },
});

const MIN_PHONE_LENGTH = 8;

function normalizePhone(value) {
    const raw = String(value || '').trim();
    let cleaned = raw.replace(/\D/g, '');
    if (cleaned.startsWith('00')) cleaned = cleaned.slice(2);
    return cleaned;
}

function isValidPhone(phone) {
    return phone.length >= MIN_PHONE_LENGTH && phone.length <= 15;
}

function splitLabels(labels) {
    if (Array.isArray(labels)) return labels.map(l => String(l).trim()).filter(Boolean);
    return String(labels || '')
        .split(',')
        .map(l => l.trim())
        .filter(Boolean);
}

function mergeLabels(existing, incoming, action) {
    const current = new Set(splitLabels(existing).map(l => l.toLowerCase()));
    const display = new Map(splitLabels(existing).map(l => [l.toLowerCase(), l]));
    for (const label of splitLabels(incoming)) {
        const key = label.toLowerCase();
        if (action === 'remove') {
            current.delete(key);
            display.delete(key);
        } else {
            current.add(key);
            display.set(key, label);
        }
    }
    return Array.from(current).map(key => display.get(key) || key).join(', ');
}

function normalizeConsentStatus(value, doNotMessage = false) {
    if (doNotMessage) return 'do_not_message';
    const safe = ['can_message', 'do_not_message', 'unknown'].includes(value) ? value : 'unknown';
    return safe;
}

function normalizeSource(value) {
    return ['manual', 'csv', 'customer_inquiry', 'imported_lead', 'unknown'].includes(value) ? value : 'manual';
}

function parseCsvFile(filePath) {
    return new Promise((resolve, reject) => {
        const rows = [];
        const detectedColumns = new Set();

        fs.createReadStream(filePath)
            .pipe(csvParser())
            .on('headers', headers => headers.forEach(h => detectedColumns.add(h)))
            .on('data', row => {
                Object.keys(row).forEach(key => detectedColumns.add(key));
                rows.push(row);
            })
            .on('end', () => resolve({ rows, detectedColumns: Array.from(detectedColumns) }))
            .on('error', reject);
    });
}

function pickMapped(row, mapping, keys) {
    const mappedKey = mapping && keys.find(key => mapping[key]);
    if (mappedKey && row[mapping[mappedKey]] !== undefined) return row[mapping[mappedKey]];
    for (const key of keys) {
        if (row[key] !== undefined) return row[key];
        const found = Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase());
        if (found) return row[found];
    }
    return '';
}

function rowToContact(row, index, mapping = {}) {
    const name = String(pickMapped(row, mapping, ['name', 'Name', 'contact_name', 'Contact'])).trim();
    const phone = normalizePhone(pickMapped(row, mapping, ['phone', 'Phone', 'number', 'Number', 'whatsapp_number', 'WhatsApp']));
    const labels = String(pickMapped(row, mapping, ['labels', 'Labels'])).trim();
    const source = normalizeSource(String(pickMapped(row, mapping, ['source', 'Source'])).trim() || 'csv');
    const source_detail = String(pickMapped(row, mapping, ['source_detail', 'Source Detail'])).trim();
    const consentRaw = String(pickMapped(row, mapping, ['consent_status', 'consent', 'Consent'])).trim().toLowerCase();
    const consent_status = consentRaw.includes('do not') || consentRaw.includes('opt out')
        ? 'do_not_message'
        : (consentRaw.includes('can') || consentRaw.includes('opt in') ? 'can_message' : 'unknown');
    return {
        row: index + 1,
        name: name || `Contact ${index + 1}`,
        phone,
        labels,
        source,
        source_detail,
        consent_status,
        do_not_message: consent_status === 'do_not_message' ? 1 : 0
    };
}

async function classifyCsvRows(userId, rows, mapping = {}) {
    const validRows = [];
    const duplicateRows = [];
    const invalidRows = [];
    const seen = new Set();

    const phones = rows.map((row, index) => rowToContact(row, index, mapping).phone).filter(Boolean);
    const existing = new Set();
    if (phones.length > 0) {
        const [existingRows] = await db.query(
            `SELECT phone FROM contacts WHERE user_id = ? AND phone IN (?)`,
            [userId, phones]
        );
        existingRows.forEach(row => existing.add(row.phone));
    }

    rows.forEach((row, index) => {
        const contact = rowToContact(row, index, mapping);
        if (!isValidPhone(contact.phone)) {
            invalidRows.push({ ...contact, reason: 'Invalid or missing phone number' });
            return;
        }
        if (seen.has(contact.phone) || existing.has(contact.phone)) {
            duplicateRows.push({ ...contact, reason: existing.has(contact.phone) ? 'Already saved' : 'Duplicate in file' });
            return;
        }
        seen.add(contact.phone);
        validRows.push(contact);
    });

    return { validRows, duplicateRows, invalidRows };
}

router.get('/', authMiddleware, async (req, res) => {
    try {
        const search = String(req.query.search || '').trim();
        const labels = splitLabels(req.query.labels);
        const status = String(req.query.status || '').trim();
        const limit = Math.min(parseInt(req.query.limit || '500', 10), 1000);
        const page = Math.max(parseInt(req.query.page || '1', 10), 1);
        const offset = (page - 1) * limit;

        const where = ['user_id = ?'];
        const params = [req.user.id];

        if (search) {
            where.push('(LOWER(name) LIKE ? OR phone LIKE ? OR LOWER(COALESCE(labels, "")) LIKE ?)');
            const term = `%${search.toLowerCase()}%`;
            params.push(term, `%${search}%`, term);
        }

        labels.forEach(label => {
            where.push('LOWER(COALESCE(labels, "")) LIKE ?');
            params.push(`%${label.toLowerCase()}%`);
        });

        if (status === 'can_message') {
            where.push('do_not_message = 0');
        } else if (status === 'do_not_message') {
            where.push('do_not_message = 1');
        } else if (status === 'unknown_consent') {
            where.push('do_not_message = 0 AND COALESCE(consent_status, "unknown") = "unknown"');
        }

        const whereSql = where.join(' AND ');
        const [[countRow]] = await db.query(
            `SELECT COUNT(*) AS total FROM contacts WHERE ${whereSql}`,
            params
        );
        const [rows] = await db.query(
            `SELECT id, name, phone, labels, source, consent_status, do_not_message, opt_out_at, source_detail, created_at
               FROM contacts
              WHERE ${whereSql}
              ORDER BY created_at DESC
              LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        return res.json({ success: true, contacts: rows, total: countRow.total, page, limit });
    } catch (err) {
        console.error('[Contacts] List error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/', authMiddleware, async (req, res) => {
    const { name, phone, labels, do_not_message, consent_status, source, source_detail } = req.body;
    const normalizedPhone = normalizePhone(phone);
    if (!name || !normalizedPhone) {
        return res.status(400).json({ success: false, message: 'name and phone are required' });
    }
    if (!isValidPhone(normalizedPhone)) {
        return res.status(400).json({ success: false, message: 'Phone number is too short or invalid' });
    }

    const optOut = do_not_message || consent_status === 'do_not_message';
    const safeConsent = normalizeConsentStatus(consent_status, optOut);

    try {
        const [result] = await db.query(
            `INSERT INTO contacts (user_id, name, phone, labels, source, do_not_message, consent_status, opt_out_at, source_detail)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.user.id,
                name,
                normalizedPhone,
                labels || null,
                normalizeSource(source),
                optOut ? 1 : 0,
                safeConsent,
                optOut ? new Date() : null,
                source_detail || null
            ]
        );
        return res.status(201).json({ success: true, contactId: result.insertId, phone: normalizedPhone });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'Contact with this phone already exists' });
        }
        console.error('[Contacts] Create error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.put('/:id', authMiddleware, async (req, res) => {
    const { name, phone, labels, do_not_message, consent_status, source, source_detail } = req.body;
    const normalizedPhone = normalizePhone(phone);
    const optOut = do_not_message || consent_status === 'do_not_message';
    const safeConsent = normalizeConsentStatus(consent_status, optOut);

    try {
        const [result] = await db.query(
            `UPDATE contacts
                SET name = ?, phone = ?, labels = ?, source = ?, source_detail = ?,
                    do_not_message = ?, consent_status = ?,
                    opt_out_at = CASE WHEN ? = 1 THEN COALESCE(opt_out_at, NOW()) ELSE NULL END
              WHERE id = ? AND user_id = ?`,
            [
                name,
                normalizedPhone,
                labels || null,
                normalizeSource(source),
                source_detail || null,
                optOut ? 1 : 0,
                safeConsent,
                optOut ? 1 : 0,
                req.params.id,
                req.user.id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Contact not found' });
        }
        return res.json({ success: true, message: 'Contact updated' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'Contact with this phone already exists' });
        }
        console.error('[Contacts] Update error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const [result] = await db.query(
            `DELETE FROM contacts WHERE id = ? AND user_id = ?`,
            [req.params.id, req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Contact not found' });
        }
        return res.json({ success: true, message: 'Contact deleted' });
    } catch (err) {
        console.error('[Contacts] Delete error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/bulk-delete', authMiddleware, async (req, res) => {
    const contactIds = Array.isArray(req.body.contactIds) ? req.body.contactIds : [];
    if (contactIds.length === 0) {
        return res.status(400).json({ success: false, message: 'contactIds are required' });
    }

    try {
        const [result] = await db.query(
            `DELETE FROM contacts WHERE user_id = ? AND id IN (?)`,
            [req.user.id, contactIds]
        );
        return res.json({ success: true, deleted: result.affectedRows });
    } catch (err) {
        console.error('[Contacts] Bulk delete error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/bulk-label', authMiddleware, async (req, res) => {
    const contactIds = Array.isArray(req.body.contactIds) ? req.body.contactIds : [];
    const labels = splitLabels(req.body.labels);
    const action = req.body.action === 'remove' ? 'remove' : 'add';

    if (contactIds.length === 0 || labels.length === 0) {
        return res.status(400).json({ success: false, message: 'contactIds and labels are required' });
    }

    try {
        const [contacts] = await db.query(
            `SELECT id, labels FROM contacts WHERE user_id = ? AND id IN (?)`,
            [req.user.id, contactIds]
        );

        for (const contact of contacts) {
            await db.query(
                `UPDATE contacts SET labels = ? WHERE id = ? AND user_id = ?`,
                [mergeLabels(contact.labels, labels, action), contact.id, req.user.id]
            );
        }

        return res.json({ success: true, updated: contacts.length });
    } catch (err) {
        console.error('[Contacts] Bulk label error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/bulk-consent', authMiddleware, async (req, res) => {
    const contactIds = Array.isArray(req.body.contactIds) ? req.body.contactIds : [];
    const consent = normalizeConsentStatus(req.body.consent_status);
    if (contactIds.length === 0) {
        return res.status(400).json({ success: false, message: 'contactIds are required' });
    }

    const doNotMessage = consent === 'do_not_message' ? 1 : 0;
    try {
        const [result] = await db.query(
            `UPDATE contacts
                SET consent_status = ?, do_not_message = ?,
                    opt_out_at = CASE WHEN ? = 1 THEN COALESCE(opt_out_at, NOW()) ELSE NULL END
              WHERE user_id = ? AND id IN (?)`,
            [consent, doNotMessage, doNotMessage, req.user.id, contactIds]
        );
        return res.json({ success: true, updated: result.affectedRows });
    } catch (err) {
        console.error('[Contacts] Bulk consent error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/:id/opt-out', authMiddleware, async (req, res) => {
    try {
        const [result] = await db.query(
            `UPDATE contacts
                SET do_not_message = 1, consent_status = 'do_not_message', opt_out_at = COALESCE(opt_out_at, NOW())
              WHERE id = ? AND user_id = ?`,
            [req.params.id, req.user.id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Contact not found' });
        return res.json({ success: true, message: 'Contact marked do not message' });
    } catch (err) {
        console.error('[Contacts] Opt-out error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/:id/opt-in', authMiddleware, async (req, res) => {
    try {
        const [result] = await db.query(
            `UPDATE contacts
                SET do_not_message = 0, consent_status = 'can_message', opt_out_at = NULL
              WHERE id = ? AND user_id = ?`,
            [req.params.id, req.user.id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Contact not found' });
        return res.json({ success: true, message: 'Contact marked can message' });
    } catch (err) {
        console.error('[Contacts] Opt-in error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/phone/:phone/opt-out', authMiddleware, async (req, res) => {
    const phone = normalizePhone(req.params.phone);
    try {
        const [result] = await db.query(
            `UPDATE contacts
                SET do_not_message = 1, consent_status = 'do_not_message', opt_out_at = COALESCE(opt_out_at, NOW())
              WHERE phone = ? AND user_id = ?`,
            [phone, req.user.id]
        );
        if (result.affectedRows === 0) {
            const [inserted] = await db.query(
                `INSERT INTO contacts (user_id, name, phone, source, do_not_message, consent_status, opt_out_at)
                 VALUES (?, ?, ?, 'customer_inquiry', 1, 'do_not_message', NOW())`,
                [req.user.id, `Contact ${phone}`, phone]
            );
            return res.json({ success: true, contactId: inserted.insertId, message: 'Contact created and opted out' });
        }
        return res.json({ success: true, message: 'Contact marked do not message' });
    } catch (err) {
        console.error('[Contacts] Phone opt-out error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/csv/preview', authMiddleware, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No CSV file uploaded' });
    }

    try {
        const mapping = req.body.mapping ? JSON.parse(req.body.mapping) : {};
        const parsed = await parseCsvFile(req.file.path);
        const classified = await classifyCsvRows(req.user.id, parsed.rows, mapping);
        return res.json({ success: true, detectedColumns: parsed.detectedColumns, ...classified });
    } catch (err) {
        console.error('[Contacts] CSV preview error:', err.message);
        return res.status(400).json({ success: false, message: 'Failed to parse CSV file' });
    } finally {
        fs.unlink(req.file.path, () => { });
    }
});

router.post('/csv/import', authMiddleware, async (req, res) => {
    const rows = Array.isArray(req.body.contacts) ? req.body.contacts : [];
    if (rows.length === 0) {
        return res.status(400).json({ success: false, message: 'No confirmed contacts provided' });
    }

    let inserted = 0;
    let skipped = 0;
    const failedRows = [];

    for (const row of rows) {
        const contact = {
            name: String(row.name || '').trim() || 'Unnamed Contact',
            phone: normalizePhone(row.phone),
            labels: String(row.labels || '').trim() || null,
            source: normalizeSource(row.source || 'csv'),
            consent_status: normalizeConsentStatus(row.consent_status, row.do_not_message),
            do_not_message: row.do_not_message || row.consent_status === 'do_not_message' ? 1 : 0,
            source_detail: row.source_detail || null
        };

        if (!isValidPhone(contact.phone)) {
            skipped++;
            failedRows.push({ ...contact, reason: 'Invalid phone number' });
            continue;
        }

        try {
            await db.query(
                `INSERT INTO contacts (user_id, name, phone, labels, source, consent_status, do_not_message, opt_out_at, source_detail)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    req.user.id,
                    contact.name,
                    contact.phone,
                    contact.labels,
                    contact.source,
                    contact.consent_status,
                    contact.do_not_message,
                    contact.do_not_message ? new Date() : null,
                    contact.source_detail
                ]
            );
            inserted++;
        } catch (err) {
            skipped++;
            failedRows.push({ ...contact, reason: err.code === 'ER_DUP_ENTRY' ? 'Already saved' : 'Import failed' });
        }
    }

    return res.json({ success: true, inserted, skipped, failedRows });
});

router.post('/csv', authMiddleware, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No CSV file uploaded' });
    }

    try {
        const parsed = await parseCsvFile(req.file.path);
        const classified = await classifyCsvRows(req.user.id, parsed.rows);
        req.body.contacts = classified.validRows;

        let inserted = 0;
        let skipped = classified.duplicateRows.length + classified.invalidRows.length;
        for (const contact of classified.validRows) {
            try {
                await db.query(
                    `INSERT INTO contacts (user_id, name, phone, labels, source, consent_status, do_not_message, opt_out_at, source_detail)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        req.user.id,
                        contact.name,
                        contact.phone,
                        contact.labels || null,
                        contact.source || 'csv',
                        contact.consent_status || 'unknown',
                        contact.do_not_message ? 1 : 0,
                        contact.do_not_message ? new Date() : null,
                        contact.source_detail || null
                    ]
                );
                inserted++;
            } catch (_) {
                skipped++;
            }
        }

        return res.json({ success: true, inserted, skipped, ...classified });
    } catch (err) {
        console.error('[Contacts] CSV import error:', err.message);
        return res.status(400).json({ success: false, message: 'Failed to parse CSV file' });
    } finally {
        fs.unlink(req.file.path, () => { });
    }
});

module.exports = router;
