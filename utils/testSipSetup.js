// scripts/testSipSetup.js
require('dotenv').config();
const db = require('../config/database');

async function testSipSetup() {
    try {
        // Test global settings
        const [settings] = await db.query('SELECT * FROM global_settings');
        console.log('\nGlobal Settings:');
        console.log(settings);

        // Test SIP peers
        const [peers] = await db.query('SELECT * FROM sip_peers');
        console.log('\nSIP Peers:');
        console.log(peers);

        // Test specific user configuration
        const userId = 1; // Change this to your test user ID
        const [userConfig] = await db.query(`
            SELECT 
                u.username,
                sp.sip_username,
                sp.domain,
                gs.setting_key,
                gs.setting_value
            FROM users u
            LEFT JOIN sip_peers sp ON u.id = sp.user_id
            CROSS JOIN global_settings gs
            WHERE u.id = ?
        `, [userId]);

        console.log('\nUser Configuration:');
        console.log(userConfig);

        process.exit(0);
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

testSipSetup();