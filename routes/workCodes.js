// routes/workCodes.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const tablePrefix = process.env.TABLE_PREFIX;

router.use(authenticateToken);

// Get all categories
router.get('/categories', async (req, res) => {
  try {
    const [categories] = await db.query(
      `SELECT * FROM ${tablePrefix}work_code_category WHERE deleted = 0 AND status = 1 ORDER BY name`
    );
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching categories' });
  }
});

// Get work codes by category
router.get('/codes/:categoryId', async (req, res) => {
  try {
    const [codes] = await db.query(
      `SELECT * FROM ${tablePrefix}work_codes WHERE category_id = ? AND deleted = 0 AND status = 1 ORDER BY name`,
      [req.params.categoryId]
    );
    res.json(codes);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching work codes' });
  }
});

// Get all work codes
router.get('/codes', async (req, res) => {
  try {
    const [codes] = await db.query(`
      SELECT wc.*, wcc.name as category_name 
      FROM ${tablePrefix}work_codes wc
      LEFT JOIN ${tablePrefix}work_code_category wcc ON wc.category_id = wcc.id
      WHERE wc.deleted = 0 AND wc.status = 1
      ORDER BY wcc.name, wc.name
    `);
    res.json(codes);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching work codes' });
  }
});

module.exports = router;