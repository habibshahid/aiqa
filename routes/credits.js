// routes/credits.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const creditService = require('../services/creditService');

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * Get credit balance
 */
router.get('/balance', async (req, res) => {
  try {
    // Only admins should access credit info
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Access denied: Admin rights required' });
    }
    
    const balance = await creditService.getCreditBalance();
    res.json(balance);
  } catch (error) {
    console.error('Error fetching credit balance:', error);
    res.status(500).json({ message: 'Error fetching credit balance', error: error.message });
  }
});

/**
 * Add credits
 */
router.post('/add', async (req, res) => {
  try {
    // Only admins should add credits
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Access denied: Admin rights required' });
    }
    
    const { amount, description } = req.body;
    
    // Validate input
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount. Must be greater than 0.' });
    }
    
    const result = await creditService.addCredits(amount, description || `Added by ${req.user.username || req.user.id}`);
    res.json(result);
  } catch (error) {
    console.error('Error adding credits:', error);
    res.status(500).json({ message: 'Error adding credits', error: error.message });
  }
});

/**
 * Update low balance threshold
 */
router.put('/threshold', async (req, res) => {
  try {
    // Only admins should update threshold
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Access denied: Admin rights required' });
    }
    
    const { threshold } = req.body;
    
    // Validate input
    if (threshold === undefined || threshold < 0 || threshold > 100) {
      return res.status(400).json({ message: 'Invalid threshold. Must be between 0 and 100.' });
    }
    
    const result = await creditService.updateLowBalanceThreshold(threshold);
    res.json(result);
  } catch (error) {
    console.error('Error updating threshold:', error);
    res.status(500).json({ message: 'Error updating threshold', error: error.message });
  }
});

/**
 * Get transaction history
 */
router.get('/transactions', async (req, res) => {
  try {
    // Only admins should access transaction history
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Access denied: Admin rights required' });
    }
    
    const { limit = 10, page = 1 } = req.query;
    
    // Calculate offset
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const result = await creditService.getTransactionHistory(parseInt(limit), offset);
    res.json(result);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ message: 'Error fetching transactions', error: error.message });
  }
});

/**
 * Get credit usage statistics
 */
router.get('/stats', async (req, res) => {
  try {
    // Only admins should access credit stats
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Access denied: Admin rights required' });
    }
    
    const stats = await creditService.getCreditUsageStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching credit stats:', error);
    res.status(500).json({ message: 'Error fetching credit stats', error: error.message });
  }
});

module.exports = router;