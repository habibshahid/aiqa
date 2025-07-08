// routes/interactions.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { Interactions } = require('../config/mongodb');
const mongoose = require('mongoose');

router.use(authenticateToken);

// Search interactions based on criteria
router.post('/search', async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      queues,
      agents,
      minDuration,
      durationComparison,
      workCodes,
      qaFormId,
      excludeEvaluated,
      direction
    } = req.body;

    // Build query object
    const query = {};

    if (excludeEvaluated === true) {
      query['extraPayload.evaluated'] = { $ne: true };
    }
    
    // Date range
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Queues filter
    if (queues && queues.length > 0) {
      // Check if queues contains numeric IDs or string names
      const isNumericIds = queues.some(q => !isNaN(parseInt(q)));
      
      if (isNumericIds) {
        // If we have numeric IDs, use the queue.id field
        query['queue.id'] = { $in: queues.map(id => parseInt(id)) };
      } else {
        // If we have string names, use the queue.name field
        query['queue.name'] = { $in: queues };
      }
    }

    // Agents filter
    if (agents && agents.length > 0) {
      query['agent.id'] = { $in: agents.map(id => parseInt(id)) };
    }

    // Duration filter
    if (minDuration !== undefined && minDuration !== null) {
      switch (durationComparison) {
        case '>':
          query['connect.duration'] = { $gt: parseInt(minDuration) };
          break;
        case '<':
          query['connect.duration'] = { $lt: parseInt(minDuration) };
          break;
        case '=':
          query['connect.duration'] = parseInt(minDuration);
          break;
        default:
          query['connect.duration'] = { $gt: parseInt(minDuration) };
      }
    }

    // Work codes filter
    if (workCodes && workCodes.length > 0) {
      query['workCodes.id'] = { $in: workCodes.map(String) };
    }

    if (direction && direction !== 'all') {
      query['direction'] = parseInt(direction);
    }
    
    // Ensure we only get interactions with recordings
    query['extraPayload.callRecording.webPath'] = { $exists: true, $ne: null };

    // Find interactions
    console.log('Searching interactions with query:', JSON.stringify(query, null, 2));
    const interactions = await Interactions.find(query)
      .sort({ createdAt: -1 })
      .lean();

    res.json(interactions);
  } catch (error) {
    console.error('Error searching interactions:', error);
    res.status(500).json({ message: 'Error searching interactions', error: error.message });
  }
});

module.exports = router;