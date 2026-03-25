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
        console.log('Renaming template_bots to message_bots...');
        await connection.query('RENAME TABLE template_bots TO message_bots;');
    } catch (err) {
        if (err.code === 'ER_TABLE_EXISTS_ERROR') {
            console.log('Table message_bots already exists.');
        } else if (err.code === 'ER_BAD_TABLE_ERROR') {
            console.log('Table template_bots not found, maybe already renamed.');
        } else {
            console.error('Rename failed:', err.message);
        }
    }

    try {
        console.log('Creating message_templates table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS message_templates (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                media_url VARCHAR(500) DEFAULT NULL,
                category VARCHAR(50) DEFAULT 'marketing',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('Table message_templates created successfully.');
    } catch (err) {
        console.error('Creation failed:', err.message);
    } finally {
        await connection.end();
    }
}

migrate();
