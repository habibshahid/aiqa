// routes/qa.js - Fixed version with improved moderation and scoring
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const analyticsService = require('../services/analyticsService');
const qaDetailService = require('../services/qaDetailService');
const transcriptionService = require('../services/transcriptionService');
const { InteractionAIQA } = require('../config/mongodb');
const scoringService = require('../services/scoringService');
const mongoose = require('mongoose');

router.use(authenticateToken);

// Get QA dashboard data
router.get('/dashboard', async (req, res) => {
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

// Get QA evaluation detail with comprehensive scoring
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
    
    // Calculate section scores with classification impacts
    try {
      const scoreDetails = await scoringService.calculateEvaluationScores(qaDetail, qaDetail.qaFormId);
      qaDetail.sectionScores = scoreDetails;
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

router.get('/evaluation/by-interaction/:interactionId', async (req, res) => {
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

router.get('/evaluation/:id/transcription', async (req, res) => {
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

// Enhanced moderation route with improved scoring
// routes/qa.js - Enhanced route for editing evaluations

// Enhanced moderation route that correctly calculates scores
// Enhanced moderation route with proper classification impact handling
router.post('/evaluation/:id/moderate', async (req, res) => {
  try {
    const { id } = req.params;
    const moderationData = req.body;
    
    console.log('Received moderation data with classifications:', 
      JSON.stringify(Object.entries(moderationData.parameters || {})
        .filter(([key, param]) => param.classification && param.classification !== 'none')
        .map(([key, param]) => ({ 
          parameter: key, 
          classification: param.classification,
          humanScore: param.humanScore
        })), null, 2)
    );
    
    // Validate input
    if (!moderationData) {
      return res.status(400).json({ message: 'Moderation data is required' });
    }
    
    // Find the evaluation
    const evaluation = await InteractionAIQA.findById(id);
    if (!evaluation) {
      return res.status(404).json({ message: 'Evaluation not found' });
    }
    
    // Get the associated QA form to calculate scores properly
    const { QAForm } = require('../config/mongodb');
    const qaForm = await QAForm.findById(evaluation.qaFormId);
    
    if (!qaForm) {
      return res.status(404).json({ message: 'QA form not found' });
    }
    
    // Calculate scores based on human evaluations and classification impacts
    let calculatedScores;
    
    // If the client sent pre-calculated scores, use them
    if (moderationData.calculatedScores) {
      console.log('Using client-provided calculated scores');
      calculatedScores = moderationData.calculatedScores;
    } else {
      // Otherwise calculate them server-side
      console.log('Calculating scores server-side');
      calculatedScores = calculateSectionScores(moderationData, qaForm);
    }
    
    console.log('Classification impacts applied in calculated scores:',
      Object.entries(calculatedScores.sections).map(([key, section]) => ({
        section: key,
        name: section.name,
        rawScore: section.rawScore,
        adjustedScore: section.adjustedScore,
        deduction: section.rawScore - section.adjustedScore,
        highestClassification: section.highestClassification,
        highestClassificationImpact: section.highestClassificationImpact
      }))
    );
    
    // Store the overall score in the evaluation
    if (calculatedScores && calculatedScores.overall) {
      if (!evaluation.evaluationData) {
        evaluation.evaluationData = { evaluation: {} };
      }
      if (!evaluation.evaluationData.evaluation) {
        evaluation.evaluationData.evaluation = {};
      }
      
      // Update totalScore and maxScore directly
      // CRITICAL: Use adjustedScore which includes classification impacts
      evaluation.evaluationData.evaluation.totalScore = calculatedScores.overall.adjustedScore;
      evaluation.evaluationData.evaluation.maxScore = calculatedScores.overall.maxScore;
      
      // Also store the full sectionScores
      evaluation.sectionScores = calculatedScores;
      
      console.log('Saving scores with classification impacts:',
        'Raw:', calculatedScores.overall.rawScore,
        'Adjusted:', calculatedScores.overall.adjustedScore,
        'Difference:', calculatedScores.overall.rawScore - calculatedScores.overall.adjustedScore
      );
    }
    
    // Add human evaluation data with metadata
    evaluation.humanEvaluation = {
      parameters: moderationData.parameters || {},
      additionalComments: moderationData.additionalComments || '',
      agentComments: moderationData.agentComments || '',
      isModerated: true,
      isPublished: moderationData.isPublished || false,
      moderatedBy: req.user ? req.user.username : 'Unknown',
      moderatedByUserId: req.user ? req.user.id : null,
      moderatedAt: new Date()
    };
    
    // Update status based on publish flag
    evaluation.status = moderationData.isPublished ? 'published' : 'moderated';
    
    // Explicitly mark fields as modified
    evaluation.markModified('evaluationData');
    evaluation.markModified('evaluationData.evaluation');
    evaluation.markModified('evaluationData.evaluation.totalScore');
    evaluation.markModified('evaluationData.evaluation.maxScore');
    evaluation.markModified('sectionScores');
    evaluation.markModified('humanEvaluation');
    
    // Save changes with debug logging
    console.log('Before save - totalScore:', evaluation.evaluationData.evaluation.totalScore);
    console.log('Before save - maxScore:', evaluation.evaluationData.evaluation.maxScore);
    
    await evaluation.save();
    
    console.log('After save - saved successfully');
    
    // Return the updated evaluation with proper scores
    const updatedEvaluation = await qaDetailService.getQAEvaluationDetail(id);
    
    // Log the scores in the returned data
    console.log('Updated evaluation totalScore:', updatedEvaluation.evaluation.totalScore);
    console.log('Updated evaluation maxScore:', updatedEvaluation.evaluation.maxScore);
    
    res.json(updatedEvaluation);
  } catch (error) {
    console.error('QA moderation error:', error);
    res.status(500).json({ message: 'Error updating evaluation', error: error.message });
  }
});

// Agent comment route
router.post('/evaluation/:id/agent-comment', async (req, res) => {
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

/**
 * Calculate scores based on human evaluation parameters and classification impacts
 * @param {Object} humanEvalData - The human evaluation data with parameters
 * @param {Object} qaForm - The QA form with groups and classification settings
 * @returns {Object} - Calculated scores by section and overall
 */
const calculateSectionScores = (humanEvalData, qaForm) => {
  if (!humanEvalData || !qaForm) {
    return {
      sections: {},
      overall: { 
        rawScore: 0, 
        adjustedScore: 0, 
        maxScore: 0, 
        percentage: 0 
      }
    };
  }
  
  // Get all parameters with human scores
  const parameters = humanEvalData.parameters || {};
  
  // Classification impact definitions from QA form
  const classificationImpacts = {};
  if (qaForm.classifications && Array.isArray(qaForm.classifications)) {
    qaForm.classifications.forEach(classification => {
      classificationImpacts[classification.type] = classification.impactPercentage / 100;
    });
  } else {
    // Default classification impacts
    classificationImpacts.minor = 0.1;    // 10%
    classificationImpacts.moderate = 0.25; // 25%
    classificationImpacts.major = 0.5;    // 50%
    classificationImpacts.none = 0;       // 0%
  }
  
  console.log('Classification impact definitions:', 
    Object.entries(classificationImpacts).map(([type, impact]) => 
      `${type}: ${(impact * 100).toFixed(0)}%`
    ).join(', ')
  );
  
  // Initialize section scores
  const sectionScores = {};
  
  // Initialize each group from the QA form
  if (qaForm.groups && Array.isArray(qaForm.groups)) {
    qaForm.groups.forEach(group => {
      sectionScores[group.id] = {
        name: group.name,
        rawScore: 0,
        maxScore: 0,
        adjustedScore: 0,
        percentage: 0,
        classifications: {
          minor: false,
          moderate: false,
          major: false
        },
        highestClassification: null,
        highestClassificationImpact: 0
      };
    });
  } else {
    // Default section if none exists
    sectionScores.default = {
      name: "Default Group",
      rawScore: 0,
      maxScore: 0,
      adjustedScore: 0,
      percentage: 0,
      classifications: {
        minor: false,
        moderate: false,
        major: false
      },
      highestClassification: null,
      highestClassificationImpact: 0
    };
  }
  
  // Process each parameter in the QA form
  if (qaForm.parameters && Array.isArray(qaForm.parameters)) {
    qaForm.parameters.forEach(paramDef => {
      const paramName = paramDef.name;
      const paramData = parameters[paramName];
      
      // Skip missing parameters or null values
      if (!paramData) return;
      
      // Get the group for this parameter
      const groupId = paramDef.group || 'default';
      const groupSection = sectionScores[groupId] || sectionScores.default;
      
      if (!groupSection) return;
      
      // Skip N/A parameters (humanScore of -1)
      // Check explicitly that humanScore exists and is not -1
      if (paramData.humanScore !== undefined && paramData.humanScore !== null && paramData.humanScore === -1) return;
      
      // Get score values - with safety checks
      const score = paramData.humanScore !== undefined && paramData.humanScore !== null ? 
        paramData.humanScore : (paramData.score !== undefined && paramData.score !== null ? 
          paramData.score : 0);
      const maxScore = paramDef.maxScore || 5;
      
      // Add to raw score and max score
      groupSection.rawScore += score;
      groupSection.maxScore += maxScore;
      
      // Track classifications - with safety checks for null/undefined
      const classification = paramData.classification || paramDef.classification || 'none';
      if (classification && classification !== 'none') {
        console.log(`Parameter ${paramName} has classification ${classification}`);
        groupSection.classifications[classification] = true;
        
        // Check if this is the highest impact classification in the group
        const impact = classificationImpacts[classification] || 0;
        if (!groupSection.highestClassification || 
            impact > (classificationImpacts[groupSection.highestClassification] || 0)) {
          groupSection.highestClassification = classification;
          groupSection.highestClassificationImpact = impact * 100; // Convert to percentage
        }
      }
    });
  }
  
  // Calculate adjusted scores based on classification impacts
  let totalRawScore = 0;
  let totalMaxScore = 0;
  let totalAdjustedScore = 0;
  
  Object.entries(sectionScores).forEach(([sectionKey, section]) => {
    if (section.maxScore === 0) return; // Skip empty sections
    
    // Apply classification impact
    const impact = section.highestClassification ? 
      (classificationImpacts[section.highestClassification] || 0) : 0;
      
    // CRITICAL: Calculate deduction based on classification
    const deduction = section.rawScore * impact;
    section.adjustedScore = Math.max(0, section.rawScore - deduction);
    
    // Print classifications and adjustment for debugging
    if (section.highestClassification) {
      console.log(`Section ${sectionKey} has ${section.highestClassification} classification with ${impact * 100}% impact:`);
      console.log(`  Raw score: ${section.rawScore}`);
      console.log(`  Deduction: ${deduction}`);
      console.log(`  Adjusted score: ${section.adjustedScore}`);
    }
    
    // Calculate percentage
    section.percentage = Math.round((section.adjustedScore / section.maxScore) * 100);
    
    // Add to totals
    totalRawScore += section.rawScore;
    totalMaxScore += section.maxScore;
    totalAdjustedScore += section.adjustedScore;
  });
  
  // Overall score calculations
  const overallPercentage = totalMaxScore > 0 ? 
    Math.round((totalAdjustedScore / totalMaxScore) * 100) : 0;
  
  // Print overall score summary
  console.log('Overall scores:');
  console.log(`  Raw score: ${totalRawScore}`);
  console.log(`  Adjusted score: ${totalAdjustedScore}`);
  console.log(`  Max score: ${totalMaxScore}`);
  console.log(`  Percentage: ${overallPercentage}%`);
  
  return {
    sections: sectionScores,
    overall: {
      rawScore: totalRawScore,
      adjustedScore: totalAdjustedScore,
      maxScore: totalMaxScore,
      percentage: overallPercentage
    }
  };
};

// Get evaluation scores with classification impacts
router.get('/evaluation/:id/scores', async (req, res) => {
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

module.exports = router;