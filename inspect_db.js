const mysql = require('mysql2/promise');
require('dotenv').config();

async function inspect() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'whatsapp_platform'
    });

    try {
        const [users] = await connection.query('DESCRIBE users;');
        console.log('Users table:', JSON.stringify(users, null, 2));

        const [bots] = await connection.query('DESCRIBE message_bots;');
        console.log('Message Bots table:', JSON.stringify(bots, null, 2));
    } catch (err) {
        console.error('Inspection failed:', err.message);
    } finally {
        await connection.end();
    }
}

inspect();
