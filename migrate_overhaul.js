const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'whatsapp_platform'
    });

    try {
        console.log('--- Starting Database Schema Overhaul ---');

        // 1. Update Campaigns
        console.log('Updating campaigns table...');
        await connection.query(`ALTER TABLE campaigns ADD COLUMN scheduled_at DATETIME DEFAULT NULL;`).catch(e => console.log('scheduled_at:', e.message));

        // 2. Update Contacts
        console.log('Updating contacts table...');
        await connection.query(`ALTER TABLE contacts ADD COLUMN metadata JSON DEFAULT NULL;`).catch(e => console.log('metadata:', e.message));

        // 3. Create WhatsApp Sessions
        console.log('Creating whatsapp_sessions table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_sessions (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id INT UNSIGNED NOT NULL,
                phone_number VARCHAR(30) DEFAULT NULL,
                status ENUM('active', 'cooldown', 'banned', 'initializing', 'disconnected') DEFAULT 'initializing',
                daily_limit INT UNSIGNED DEFAULT 500,
                sent_today INT UNSIGNED DEFAULT 0,
                warmup_count INT UNSIGNED DEFAULT 0,
                last_used_at DATETIME DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `);

        // 4. Create Warmup Logs
        console.log('Creating warmup_logs table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS warmup_logs (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                from_session_id INT UNSIGNED NOT NULL,
                to_session_id INT UNSIGNED NOT NULL,
                message_body TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (from_session_id) REFERENCES whatsapp_sessions(id) ON DELETE CASCADE,
                FOREIGN KEY (to_session_id) REFERENCES whatsapp_sessions(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `);

        // 5. Create Visual Flow Builder Tables
        console.log('Creating flow_nodes and flow_edges tables...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS flow_nodes (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id INT UNSIGNED NOT NULL,
                name VARCHAR(255) DEFAULT 'Untitled Node',
                type ENUM('keyword', 'message', 'delay', 'condition') NOT NULL,
                content JSON DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS flow_edges (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                from_node_id INT UNSIGNED NOT NULL,
                to_node_id INT UNSIGNED NOT NULL,
                condition_value VARCHAR(255) DEFAULT NULL,
                FOREIGN KEY (from_node_id) REFERENCES flow_nodes(id) ON DELETE CASCADE,
                FOREIGN KEY (to_node_id) REFERENCES flow_nodes(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `);

        // 6. Update chat_logs for Multi-Session
        console.log('Updating chat_logs for multi-session support...');
        await connection.query(`ALTER TABLE chat_logs ADD COLUMN session_id INT UNSIGNED DEFAULT NULL;`).catch(e => console.log('session_id:', e.message));

        // 7. Create Blacklist Table
        console.log('Creating blacklist table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS blacklist (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id INT UNSIGNED NOT NULL,
                phone_number VARCHAR(30) NOT NULL,
                reason VARCHAR(255) DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_user_blacklisted_phone (user_id, phone_number),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `);

        console.log('--- Migration Completed Successfully ---');
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        await connection.end();
    }
}

migrate();
