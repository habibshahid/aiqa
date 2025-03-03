// routes/sip.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../config/database');
const tablePrefix = process.env.TABLE_PREFIX;

router.use(authenticateToken);

// Get SIP configuration for current user
// routes/sip.js
router.get('/config', async (req, res) => {
  try {
    // Get user's SIP credentials
    const [sipPeers] = await db.query(
      `SELECT sip_username, sip_password, domain FROM ${tablePrefix}sip_peers WHERE user_id = ? AND active = true`,
      [req.user.id]
    );

    if (!sipPeers.length) {
      return res.status(404).json({ message: 'No SIP configuration found for user' });
    }

    // Get global settings
    const [settings] = await db.query(
      `SELECT setting_key, setting_value FROM ${tablePrefix}settings`
    );

    // Default ICE servers
    const defaultIceServers = [{
      urls: 'stun:stun.l.google.com:19302'
    }];

    // Convert settings to object
    const globalConfig = {};
    settings.forEach(setting => {
      if (setting.setting_key === 'ice_servers') {
        try {
          globalConfig.ice_servers = JSON.parse(setting.setting_value);
        } catch (error) {
          console.warn('Invalid ICE servers setting, using defaults');
          globalConfig.ice_servers = defaultIceServers;
        }
      } else {
        globalConfig[setting.setting_key] = setting.setting_value;
      }
    });

    // Prepare response
    const config = {
      sipUsername: sipPeers[0].sip_username,
      sipPassword: sipPeers[0].sip_password,
      sipDomain: sipPeers[0].domain || globalConfig.sip_server,
      webrtcGateway: globalConfig.webrtc_gateway || 'wss://your-sip-server:8089/ws',
      iceServers: defaultIceServers
    };

    console.log('Sending SIP config:', {
      ...config,
      sipPassword: '***hidden***'
    });

    res.json(config);

  } catch (error) {
    console.error('Error fetching SIP config:', error);
    res.status(500).json({ message: 'Error fetching SIP configuration' });
  }
});

module.exports = router;