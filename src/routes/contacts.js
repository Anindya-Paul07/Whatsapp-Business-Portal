const express = require('express');
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * Normalizes phone numbers by removing all non-digit characters.
 */
const normalizePhone = (phone) => {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
};

// Multer: store CSV uploads in ./uploads/
const upload = multer({
    dest: path.resolve('./uploads'),
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are accepted'), false);
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// ── GET /contacts ─────────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, name, phone, labels, source, created_at
         FROM contacts
        WHERE user_id = ?
        ORDER BY created_at DESC`,
            [req.user.id]
        );
        return res.json({ success: true, contacts: rows });
    } catch (err) {
        console.error('[Contacts] List error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ── POST /contacts ────────────────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
    const { name, phone, labels } = req.body;
    if (!name || !phone) {
        return res.status(400).json({ success: false, message: 'name and phone are required' });
    }

    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) {
        return res.status(400).json({ success: false, message: 'Invalid phone number' });
    }

    try {
        const [result] = await db.query(
            `INSERT INTO contacts (user_id, name, phone, labels, source)
       VALUES (?, ?, ?, ?, 'manual')`,
            [req.user.id, name, cleanPhone, labels || null]
        );
        return res.status(201).json({ success: true, contactId: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'Contact with this phone already exists' });
        }
        console.error('[Contacts] Create error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ── PUT /contacts/:id ─────────────────────────────────────────
router.put('/:id', authMiddleware, async (req, res) => {
    const { name, phone, labels } = req.body;
    const contactId = req.params.id;

    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) {
        return res.status(400).json({ success: false, message: 'Invalid phone number' });
    }

    try {
        const [result] = await db.query(
            `UPDATE contacts SET name = ?, phone = ?, labels = ?
        WHERE id = ? AND user_id = ?`,
            [name, cleanPhone, labels || null, contactId, req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Contact not found' });
        }
        return res.json({ success: true, message: 'Contact updated' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'Another contact with this phone already exists' });
        }
        console.error('[Contacts] Update error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ── DELETE /contacts/:id ──────────────────────────────────────
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

// ── POST /contacts/csv ────────────────────────────────────────
// Bulk import from a CSV file.  Expected columns: name, phone, labels (optional)
router.post('/csv', authMiddleware, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No CSV file uploaded' });
    }

    const results = [];
    const filePath = req.file.path;

    try {
        await new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe(csvParser())
                .on('data', (row) => {
                    const rawPhone = (row.phone || row.Phone || row.PHONE || '').trim();
                    const name = (row.name || row.Name || row.NAME || '').trim();
                    const phone = normalizePhone(rawPhone);
                    if (phone) {
                        results.push({ name, phone, labels: row.labels || row.Labels || null });
                    }
                })
                .on('end', resolve)
                .on('error', reject);
        });

        fs.unlinkSync(filePath); // clean up temp file

        if (results.length === 0) {
            return res.status(400).json({ success: false, message: 'CSV has no valid rows with phone numbers' });
        }

        let inserted = 0;
        let skipped = 0;

        for (const contact of results) {
            try {
                await db.query(
                    `INSERT INTO contacts (user_id, name, phone, labels, source)
           VALUES (?, ?, ?, ?, 'csv')`,
                    [req.user.id, contact.name, contact.phone, contact.labels]
                );
                inserted++;
            } catch (_) {
                skipped++; // duplicate or constraint error
            }
        }

        return res.json({
            success: true,
            message: `CSV import complete: ${inserted} inserted, ${skipped} skipped`,
            inserted,
            skipped,
        });
    } catch (err) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        console.error('[Contacts] CSV import error:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
