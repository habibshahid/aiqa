// routes/qa.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const analyticsService = require('../services/analyticsService');
const qaDetailService = require('../services/qaDetailService');
const transcriptionService = require('../services/transcriptionService');

router.use(authenticateToken);

// Get QA dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    const { agentId, queueId, startDate, endDate } = req.query;
    
    const filters = {
      ...(agentId && { agentId }),
      ...(queueId && { queueId }),
      ...(startDate && endDate && {
        dateRange: { start: startDate, end: endDate }
      })
    };

    const qaMetrics = await analyticsService.getEvaluationMetrics(filters);
    res.json(qaMetrics);
  } catch (error) {
    console.error('QA Dashboard error:', error);
    res.status(500).json({ message: 'Error fetching QA metrics' });
  }
});

// Get filter options
router.get('/filters', async (req, res) => {
  try {
    const options = await analyticsService.getFilterOptions();
    res.json(options);
  } catch (error) {
    console.error('Filter options error:', error);
    res.status(500).json({ message: 'Error fetching filter options' });
  }
});

// Get QA evaluation detail
router.get('/evaluation/:id', async (req, res) => {
  try {
    const qaDetail = await qaDetailService.getQAEvaluationDetail(req.params.id);
    if (!qaDetail) {
      return res.status(404).json({ message: 'QA evaluation not found' });
    }

    // Get transcription analysis if available
    const transcriptionAnalysis = await transcriptionService
      .getTranscriptionAnalysis(qaDetail.interactionId);

    if (transcriptionAnalysis) {
      qaDetail.transcriptionAnalysis = transcriptionAnalysis;
    }

    res.json(qaDetail);
  } catch (error) {
    console.error('QA detail error:', error);
    res.status(500).json({ message: 'Error fetching QA evaluation details' });
  }
});

router.get('/evaluation/by-interaction/:interactionId', authenticateToken, async (req, res) => {
  try {
    const { interactionId } = req.params;
    
    // Find the evaluation by interaction ID
    const evaluation = await InteractionAIQA.findOne({ interactionId });
    
    if (!evaluation) {
      return res.status(404).json({ message: 'Evaluation not found for this interaction' });
    }
    
    // Return the evaluation ID for redirection
    res.json({ evaluationId: evaluation._id });
  } catch (error) {
    console.error('Error finding evaluation by interaction ID:', error);
    res.status(500).json({ message: 'Error finding evaluation' });
  }
});

module.exports = router;