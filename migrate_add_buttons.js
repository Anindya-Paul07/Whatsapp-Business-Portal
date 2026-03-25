const mysql = require('mysql2/promise');
require('dotenv').config();

async function addColumn(conn, sql, desc) {
    try {
        await conn.query(sql);
        console.log(`  ✓ ${desc}`);
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME' || e.errno === 1060) {
            console.log(`  → ${desc} already exists, skipping.`);
        } else {
            throw e;
        }
    }
}

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'whatsapp_platform'
    });

    try {
        console.log('--- Patching missing schema columns ---\n');

        // ── message_templates ──────────────────────────────────────
        console.log('[message_templates]');
        await addColumn(connection,
            `ALTER TABLE message_templates ADD COLUMN buttons JSON DEFAULT NULL`,
            'buttons (JSON)'
        );
        await addColumn(connection,
            `ALTER TABLE message_templates ADD COLUMN category VARCHAR(50) DEFAULT 'marketing'`,
            'category (VARCHAR)'
        );

        // ── campaigns ─────────────────────────────────────────────
        console.log('\n[campaigns]');
        await addColumn(connection,
            `ALTER TABLE campaigns ADD COLUMN template_id INT UNSIGNED DEFAULT NULL`,
            'template_id (INT UNSIGNED)'
        );
        await addColumn(connection,
            `ALTER TABLE campaigns ADD COLUMN scheduled_at DATETIME DEFAULT NULL`,
            'scheduled_at (DATETIME)'
        );
        await addColumn(connection,
            `ALTER TABLE campaigns ADD COLUMN sent_count INT UNSIGNED DEFAULT 0`,
            'sent_count (INT)'
        );
        await addColumn(connection,
            `ALTER TABLE campaigns ADD COLUMN fail_count INT UNSIGNED DEFAULT 0`,
            'fail_count (INT)'
        );

        // ── whatsapp_sessions status enum ─────────────────────────
        console.log('\n[whatsapp_sessions]');
        try {
            await connection.query(`
                ALTER TABLE whatsapp_sessions
                MODIFY COLUMN status ENUM('active','inactive','cooldown','banned','initializing','disconnected') DEFAULT 'initializing'
            `);
            console.log('  ✓ status enum updated (added inactive)');
        } catch (e) {
            console.log('  → status enum:', e.message);
        }

        console.log('\n--- All patches applied successfully ---');
    } catch (err) {
        console.error('\nMigration failed:', err.message);
    } finally {
        await connection.end();
    }
}

migrate();

