// routes/dashboard.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const analyticsService = require('../services/analyticsService');
const qaDetailService = require('../services/qaDetailService');
const { pool } = require('../config/database'); 
router.use(authenticateToken);

// Get dashboard metrics and QA data
router.get('/metrics', async (req, res) => {
  try {
    let { agentId, queueId, startDate, endDate, formId } = req.query;
    
    // If user is not admin, restrict to their agent data only
    if (!req.user.isAdmin && req.user.agentId) {
      agentId = req.user.agentId;
      
      // Inform frontend that this is a restricted view
      res.set('X-Restricted-View', 'agent-only');
    }

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
      areasNeedingFocus: qaMetrics?.areasOfImprovement?.slice(0, 3) || [],
      isRestrictedView: !req.user.isAdmin && !!req.user.agentId
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
    if (!req.user.isAdmin && req.user.agentId) {
      // If user is an agent, only show their own data in the agent filter
      options.agents = options.agents.filter(agent => 
        agent.id.toString() === req.user.agentId.toString()
      );
      
      // Inform frontend that this is a restricted view
      res.set('X-Restricted-View', 'agent-only');
    }
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
    if (!req.user.isAdmin && req.user.agentId) {
      // Check if this evaluation belongs to this agent
      const evaluationAgentId = qaDetail.agent?.id?.toString();
      
      if (evaluationAgentId !== req.user.agentId.toString()) {
        return res.status(403).json({ 
          message: 'You do not have permission to view this evaluation',
          data: null
        });
      }
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