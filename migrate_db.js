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
        console.log('Adding buttons column to message_templates...');
        await connection.query(`ALTER TABLE message_templates ADD COLUMN buttons JSON DEFAULT NULL;`).catch(e => console.log(e.message));

        console.log('Adding scheduler columns to campaigns...');
        await connection.query(`ALTER TABLE campaigns ADD COLUMN template_id INT UNSIGNED DEFAULT NULL;`).catch(e => console.log(e.message));
        await connection.query(`ALTER TABLE campaigns ADD COLUMN schedule_type VARCHAR(50) DEFAULT 'immediate';`).catch(e => console.log(e.message));
        await connection.query(`ALTER TABLE campaigns ADD COLUMN start_date DATE DEFAULT NULL;`).catch(e => console.log(e.message));
        await connection.query(`ALTER TABLE campaigns ADD COLUMN end_date DATE DEFAULT NULL;`).catch(e => console.log(e.message));
        await connection.query(`ALTER TABLE campaigns ADD COLUMN run_time TIME DEFAULT NULL;`).catch(e => console.log(e.message));

        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        await connection.end();
    }
}

migrate();
