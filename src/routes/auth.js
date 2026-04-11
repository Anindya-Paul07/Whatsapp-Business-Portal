const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const router = express.Router();

// ──────────────────────────────────────────────────────────────
//  POST /auth/register
// ──────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
    const { email, password, role } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'email and password required' });
    }

    try {
        const hash = await bcrypt.hash(password, 12);
        const safeRole = ['admin', 'user'].includes(role) ? role : 'user';

        const [result] = await db.query(
            `INSERT INTO users (email, password, role) VALUES (?, ?, ?)`,
            [email, hash, safeRole]
        );

        return res.status(201).json({
            success: true,
            message: 'User registered',
            userId: result.insertId,
        });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'Email already registered' });
        }
        console.error('[Auth] Register error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ──────────────────────────────────────────────────────────────
//  POST /auth/login
// ──────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'email and password required' });
    }

    try {
        const [[user]] = await db.query(
            `SELECT id, email, password, role FROM users WHERE email = ? LIMIT 1`,
            [email]
        );

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this',
            { expiresIn: '7d' }
        );

        return res.json({
            success: true,
            token,
            user: { id: user.id, email: user.email, role: user.role },
        });
    } catch (err) {
        console.error('[Auth] Login error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
