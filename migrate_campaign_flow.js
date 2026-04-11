const mysql = require('mysql2/promise');
require('dotenv').config();

async function addColumn(conn, table, sql, desc) {
    try {
        await conn.query(`ALTER TABLE ${table} ADD COLUMN ${sql}`);
        console.log(`  ✓ ${desc}`);
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME' || e.errno === 1060) {
            console.log(`  → ${desc} already exists, skipping.`);
            return;
        }
        throw e;
    }
}

async function modifyColumn(conn, table, sql, desc) {
    try {
        await conn.query(`ALTER TABLE ${table} MODIFY COLUMN ${sql}`);
        console.log(`  ✓ ${desc}`);
    } catch (e) {
        console.warn(`  → ${desc} could not be modified automatically: ${e.message}`);
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
        console.log('--- Campaign flow migration ---');

        console.log('\n[contacts]');
        await modifyColumn(connection, 'contacts', `source ENUM('manual','csv','customer_inquiry','imported_lead','unknown') NOT NULL DEFAULT 'manual'`, 'contact source supports real-world origins');
        await addColumn(connection, 'contacts', `do_not_message TINYINT(1) NOT NULL DEFAULT 0`, 'do_not_message');
        await addColumn(connection, 'contacts', `consent_status ENUM('can_message','do_not_message','unknown') NOT NULL DEFAULT 'unknown'`, 'consent_status');
        await addColumn(connection, 'contacts', `opt_out_at DATETIME DEFAULT NULL`, 'opt_out_at');
        await addColumn(connection, 'contacts', `source_detail VARCHAR(255) DEFAULT NULL`, 'source_detail');
        await connection.query(`
            UPDATE contacts
               SET consent_status = CASE WHEN do_not_message = 1 THEN 'do_not_message' ELSE COALESCE(NULLIF(consent_status, ''), 'unknown') END,
                   opt_out_at = CASE WHEN do_not_message = 1 AND opt_out_at IS NULL THEN NOW() ELSE opt_out_at END
        `);

        console.log('\n[campaigns]');
        await modifyColumn(connection, 'campaigns', `status ENUM('pending','processing','paused','completed','failed') NOT NULL DEFAULT 'pending'`, 'campaign status supports paused');
        await addColumn(connection, 'campaigns', `audience_type VARCHAR(50) DEFAULT NULL`, 'audience_type');
        await addColumn(connection, 'campaigns', `audience_snapshot_json JSON DEFAULT NULL`, 'audience_snapshot_json');
        await addColumn(connection, 'campaigns', `scheduled_at DATETIME DEFAULT NULL`, 'scheduled_at');
        await addColumn(connection, 'campaigns', `started_at DATETIME DEFAULT NULL`, 'started_at');
        await addColumn(connection, 'campaigns', `finished_at DATETIME DEFAULT NULL`, 'finished_at');
        await addColumn(connection, 'campaigns', `paused_at DATETIME DEFAULT NULL`, 'paused_at');
        await addColumn(connection, 'campaigns', `batch_limit INT UNSIGNED DEFAULT 50`, 'batch_limit');
        await addColumn(connection, 'campaigns', `delay_min_seconds INT UNSIGNED DEFAULT 20`, 'delay_min_seconds');
        await addColumn(connection, 'campaigns', `delay_max_seconds INT UNSIGNED DEFAULT 45`, 'delay_max_seconds');
        await addColumn(connection, 'campaigns', `deep_pause_every INT UNSIGNED DEFAULT 15`, 'deep_pause_every');
        await addColumn(connection, 'campaigns', `deep_pause_min_minutes INT UNSIGNED DEFAULT 5`, 'deep_pause_min_minutes');
        await addColumn(connection, 'campaigns', `deep_pause_max_minutes INT UNSIGNED DEFAULT 10`, 'deep_pause_max_minutes');
        await addColumn(connection, 'campaigns', `send_window_start TIME DEFAULT '10:00:00'`, 'send_window_start');
        await addColumn(connection, 'campaigns', `send_window_end TIME DEFAULT '20:00:00'`, 'send_window_end');
        await addColumn(connection, 'campaigns', `failure_pause_threshold INT UNSIGNED DEFAULT 10`, 'failure_pause_threshold');
        await addColumn(connection, 'campaigns', `skipped_count INT UNSIGNED DEFAULT 0`, 'skipped_count');
        await addColumn(connection, 'campaigns', `media_url VARCHAR(500) DEFAULT NULL`, 'media_url');

        console.log('\n[campaign_recipients]');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS campaign_recipients (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                campaign_id INT UNSIGNED NOT NULL,
                contact_id INT UNSIGNED DEFAULT NULL,
                name VARCHAR(255) DEFAULT NULL,
                phone VARCHAR(30) NOT NULL,
                status ENUM('pending','sent','failed','skipped') NOT NULL DEFAULT 'pending',
                failure_code VARCHAR(50) DEFAULT NULL,
                error_message TEXT DEFAULT NULL,
                sent_at DATETIME DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_campaign_status (campaign_id, status),
                INDEX idx_campaign_phone (campaign_id, phone),
                FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
                FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
            ) ENGINE=InnoDB;
        `);
        console.log('  ✓ campaign_recipients ready');
        await addColumn(connection, 'campaign_recipients', `failure_code VARCHAR(50) DEFAULT NULL`, 'campaign_recipients.failure_code');

        console.log('\n[message_bots]');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS message_bots (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id INT UNSIGNED NOT NULL,
                keyword VARCHAR(500) NOT NULL,
                reply_text TEXT NOT NULL,
                reply_type ENUM('exact','contains') NOT NULL DEFAULT 'contains',
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                priority INT UNSIGNED NOT NULL DEFAULT 100,
                is_system TINYINT(1) NOT NULL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `);
        await addColumn(connection, 'message_bots', `priority INT UNSIGNED NOT NULL DEFAULT 100`, 'priority');
        await addColumn(connection, 'message_bots', `is_system TINYINT(1) NOT NULL DEFAULT 0`, 'is_system');

        console.log('\n--- Migration completed ---');
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exitCode = 1;
    } finally {
        await connection.end();
    }
}

migrate();
