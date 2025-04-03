// routes/qa.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const analyticsService = require('../services/analyticsService');
const qaDetailService = require('../services/qaDetailService');
const transcriptionService = require('../services/transcriptionService');
const { InteractionAIQA } = require('../config/mongodb');
const scoringService = require('../services/scoringService');

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

router.get('/evaluation/:id/transcription', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    // Convert to numbers
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    // Get transcription with pagination
    const result = await transcriptionService.getPaginatedTranscription(
      id, pageNum, limitNum
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching paginated transcription:', error);
    res.status(500).json({ message: 'Error fetching transcription' });
  }
});

router.post('/evaluation/:id/moderate', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const moderationData = req.body;
    
    // Validate input
    if (!moderationData) {
      return res.status(400).json({ message: 'Moderation data is required' });
    }
    
    // Find the evaluation
    const evaluation = await InteractionAIQA.findById(id);
    if (!evaluation) {
      return res.status(404).json({ message: 'Evaluation not found' });
    }
    
    // Calculate new total score based on human scores
    let totalScore = 0;
    let totalMaxScore = 0;
    
    if (moderationData.parameters) {
      for (const [paramName, paramData] of Object.entries(moderationData.parameters)) {
        // Only include if we have a valid human score
        if (paramData.humanScore !== undefined && paramData.humanScore !== null) {
          // Get the original parameter data to find the max score
          const originalParam = evaluation.evaluationData.evaluation.parameters.get(paramName);
          if (originalParam) {
            const maxScore = originalParam.maxScore || 5; // Default to 5 if not specified
            
            // Add to totals
            totalScore += paramData.humanScore;
            totalMaxScore += maxScore;
          }
        }
      }
    }
    
    // Add human evaluation data
    evaluation.humanEvaluation = moderationData;
    
    // Update status based on publish flag
    evaluation.status = moderationData.isPublished ? 'published' : 'moderated';
    
    // Update the evaluation's total score if we calculated a new one
    if (totalMaxScore > 0) {
      evaluation.evaluationData.evaluation.totalScore = totalScore;
      evaluation.evaluationData.evaluation.maxScore = totalMaxScore;
    }
    
    // Save changes
    await evaluation.save();
    
    // Return updated evaluation
    res.json(evaluation);
  } catch (error) {
    console.error('QA moderation error:', error);
    res.status(500).json({ message: 'Error updating evaluation', error: error.message });
  }
});

// Get agent comments for an evaluation
router.post('/evaluation/:id/agent-comment', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    
    // Validate
    if (!comment) {
      return res.status(400).json({ message: 'Comment is required' });
    }
    
    // Find evaluation
    const evaluation = await InteractionAIQA.findById(id);
    if (!evaluation) {
      return res.status(404).json({ message: 'Evaluation not found' });
    }
    
    // Ensure it's published
    if (evaluation.status !== 'published') {
      return res.status(403).json({ message: 'Cannot comment on unpublished evaluation' });
    }
    
    // Add or update agent comment
    if (!evaluation.humanEvaluation) {
      evaluation.humanEvaluation = {
        isModerated: true,
        isPublished: true,
        agentComments: comment
      };
    } else {
      evaluation.humanEvaluation.agentComments = comment;
    }
    
    // Save changes
    await evaluation.save();
    
    // Return updated evaluation
    res.json(evaluation);
  } catch (error) {
    console.error('Agent comment error:', error);
    res.status(500).json({ message: 'Error adding comment', error: error.message });
  }
});

// Get evaluation scores with classification impacts
router.get('/evaluation/:id/scores', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the evaluation
    const qaDetail = await qaDetailService.getQAEvaluationDetail(id);
    if (!qaDetail) {
      return res.status(404).json({ message: 'QA evaluation not found' });
    }
    
    // Get section scores with classification impacts
    const scoreDetails = await scoringService.calculateEvaluationScores(
      qaDetail, 
      qaDetail.qaFormId
    );
    
    res.json(scoreDetails);
  } catch (error) {
    console.error('Error calculating evaluation scores:', error);
    res.status(500).json({ 
      message: 'Error calculating evaluation scores',
      error: error.message
    });
  }
});

// Update an existing route to include section scores
// Modify the existing '/evaluation/:id' route to include scores
router.get('/evaluation/:id', authenticateToken, async (req, res) => {
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
    
    // Calculate section scores with classification impacts
    try {
      const scoreDetails = await scoringService.calculateEvaluationScores(
        qaDetail, 
        qaDetail.qaFormId
      );
      qaDetail.sectionScores = scoreDetails.scores;
    } catch (scoreError) {
      console.warn('Error calculating section scores:', scoreError);
      // Continue without section scores if there's an error
    }

    res.json(qaDetail);
  } catch (error) {
    console.error('QA detail error:', error);
    res.status(500).json({ message: 'Error fetching QA evaluation details' });
  }
});

module.exports = router;