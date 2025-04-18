// routes/queues.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const tablePrefix = process.env.TABLE_PREFIX;

router.use(authenticateToken);

// Get all active queues
router.get('/all', authenticateToken, async (req, res) => {
  try {
    const tablePrefix = process.env.TABLE_PREFIX || 'yovo_tbl_';
    
    const [queues] = await db.query(
      `SELECT id, queue as name FROM ${tablePrefix}queues ORDER BY queue`
    );
    
    // Convert the IDs to strings for consistent handling in the frontend
    const formattedQueues = queues.map(queue => ({
      id: queue.id.toString(),
      name: queue.name
    }));
    
    res.json(formattedQueues);
  } catch (error) {
    console.error('Error fetching all queues:', error);
    res.status(500).json({ message: 'Error fetching queues' });
  }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const tablePrefix = process.env.TABLE_PREFIX || 'yovo_tbl_';
    
    const [queues] = await db.query(
      `SELECT id, name as name FROM ${tablePrefix}queues ORDER BY name`
    );
    
    // Convert the IDs to strings for consistent handling in the frontend
    const formattedQueues = queues.map(queue => ({
      id: queue.id.toString(),
      name: queue.name
    }));
    
    res.json(formattedQueues);
  } catch (error) {
    console.error('Error fetching all queues:', error);
    res.status(500).json({ message: 'Error fetching queues' });
  }
});

module.exports = router;
