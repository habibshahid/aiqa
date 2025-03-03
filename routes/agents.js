// routes/agents.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

const tablePrefix = process.env.TABLE_PREFIX;

// Get all active queues
router.get('/', async (req, res) => {
  try {
    const [agents] = await db.query(
      `SELECT id, concat_ws(" ", first_name, last_name) as name FROM ${tablePrefix}users where is_agent = 1 and active = 1 order by first_name`
    );
    res.json(agents);
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ message: 'Error fetching agents' });
  }
});

module.exports = router;
