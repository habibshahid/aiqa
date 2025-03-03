// scripts/createSipTables.js
require('dotenv').config();
const db = require('../config/database');

async function createSipTables() {
  try {
    // Create sip_peers table
    await db.query(`
      CREATE TABLE IF NOT EXISTS sip_peers (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        sip_username VARCHAR(50) NOT NULL,
        sip_password VARCHAR(255) NOT NULL,
        domain VARCHAR(255),
        outbound_proxy VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_sip_username (sip_username)
      )
    `);

    // Create global_settings table
    await db.query(`
      CREATE TABLE IF NOT EXISTS global_settings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        setting_key VARCHAR(50) UNIQUE NOT NULL,
        setting_value TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Insert default global settings
    const defaultSettings = [
      {
        key: 'webrtc_gateway',
        value: 'wss://sip.example.com:8089/ws',
        description: 'WebRTC Gateway WebSocket Address'
      },
      {
        key: 'sip_server',
        value: 'sip.example.com',
        description: 'SIP Server Domain'
      },
      {
        key: 'stun_server',
        value: 'stun:stun.example.com:3478',
        description: 'STUN Server Address'
      },
      {
        key: 'ice_servers',
        value: JSON.stringify([
          { urls: ['stun:stun.example.com:3478'] },
          { 
            urls: ['turn:turn.example.com:3478'],
            username: 'turnuser',
            credential: 'turnpass'
          }
        ]),
        description: 'ICE Server Configuration'
      }
    ];

    for (const setting of defaultSettings) {
      await db.query(`
        INSERT INTO global_settings (setting_key, setting_value, description)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
        setting_value = VALUES(setting_value),
        description = VALUES(description)
      `, [setting.key, setting.value, setting.description]);
    }

    console.log('SIP tables and settings created successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error creating SIP tables:', error);
    process.exit(1);
  }
}

createSipTables();