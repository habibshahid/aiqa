// routes/dashboard.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const analyticsService = require('../services/analyticsService');
const qaDetailService = require('../services/qaDetailService');

router.use(authenticateToken);

// Get dashboard metrics and QA data
router.get('/metrics', async (req, res) => {
  try {
    const { agentId, queueId, startDate, endDate, formId } = req.query;
    
    const filters = {
      ...(agentId && { agentId }),
      ...(queueId && { queueId }),
      ...(formId && { formId }),
      ...(startDate && endDate && {
        dateRange: { start: startDate, end: endDate }
      })
    };

    const qaMetrics = await analyticsService.getEvaluationMetrics(filters);

    const response = {
      qa: qaMetrics,
      totalEvaluations: qaMetrics?.totalEvaluations || 0,
      bestPerformer: qaMetrics?.bestPerformer || null,
      areasNeedingFocus: qaMetrics?.areasOfImprovement?.slice(0, 3) || []
    };

    res.json(response);
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    // Send a safe response with default values
    res.status(500).json({ 
      message: 'Error fetching dashboard metrics',
      qa: {
        totalEvaluations: 0,
        criteriaScores: {},
        agentPerformance: [],
        bestPerformer: null,
        areasOfImprovement: [],
        areasOfExcellence: [],
        recentEvaluations: []
      },
      totalEvaluations: 0,
      bestPerformer: null,
      areasNeedingFocus: []
    });
  }
});

// Get filter options
router.get('/filters', async (req, res) => {
  try {
    const options = await analyticsService.getFilterOptions();
    res.json(options);
  } catch (error) {
    console.error('Filter options error:', error);
    res.status(500).json({ 
      message: 'Error fetching filter options',
      agents: [],
      queues: [] 
    });
  }
});

// Get QA evaluation detail
router.get('/evaluation/:id', async (req, res) => {
  try {
    const qaDetail = await qaDetailService.getQAEvaluationDetail(req.params.id);
    if (!qaDetail) {
      return res.status(404).json({ 
        message: 'QA evaluation not found',
        data: null
      });
    }
    res.json(qaDetail);
  } catch (error) {
    console.error('QA detail error:', error);
    res.status(500).json({ 
      message: 'Error fetching QA evaluation details',
      data: null
    });
  }
});

module.exports = router;