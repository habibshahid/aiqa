// routes/queues.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const tablePrefix = process.env.TABLE_PREFIX;

router.use(authenticateToken);

// Get all active queues
router.get('/', async (req, res) => {
  try {
    const [queues] = await db.query(
      `SELECT id, name FROM ${tablePrefix}queues ORDER BY name`
    );
    res.json(queues);
  } catch (error) {
    console.error('Error fetching queues:', error);
    res.status(500).json({ message: 'Error fetching queues' });
  }
});

module.exports = router;
