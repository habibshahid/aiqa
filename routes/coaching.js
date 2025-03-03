// routes/coaching.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { InteractionAIQA } = require('../config/mongodb');

router.use(authenticateToken);

// Get coaching insights for an agent
router.get('/agent/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { startDate, endDate } = req.query;
    
    console.log('Coaching Request:', { agentId, startDate, endDate });
    
    const query = {};
    
    // Handle both string and number comparisons for agent ID
    query['interactionData.agent.id'] = { $in: [agentId, parseInt(agentId)] };
    
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    console.log('MongoDB Query:', JSON.stringify(query));
    
    // Check if we have matching evaluations
    const matchCount = await InteractionAIQA.countDocuments(query);
    console.log('Matching evaluations:', matchCount);
    
    // If no matches, try with just the agent ID
    const evaluations = matchCount > 0
      ? await InteractionAIQA.find(query).sort({ createdAt: -1 }).lean()
      : await InteractionAIQA.find({ 'interactionData.agent.id': { $in: [agentId, parseInt(agentId)] } })
          .sort({ createdAt: -1 })
          .limit(100)
          .lean();
    
    console.log(`Processing ${evaluations.length} evaluations for coaching`);
    
    // Analyze strengths and weaknesses
    const areasOfImprovement = {};
    const strengths = {};
    const parameterScores = {};
    
    evaluations.forEach(eval => {
      // Areas of improvement
      if (eval.evaluationData?.evaluation?.areasOfImprovements) {
        eval.evaluationData.evaluation.areasOfImprovements.forEach(area => {
          areasOfImprovement[area] = (areasOfImprovement[area] || 0) + 1;
        });
      }
      
      // Strengths
      if (eval.evaluationData?.evaluation?.whatTheAgentDidWell) {
        eval.evaluationData.evaluation.whatTheAgentDidWell.forEach(strength => {
          strengths[strength] = (strengths[strength] || 0) + 1;
        });
      }
      
      // Parameter scores
      if (eval.evaluationData?.evaluation?.parameters) {
        Object.entries(eval.evaluationData.evaluation.parameters).forEach(([param, data]) => {
          if (!parameterScores[param]) {
            parameterScores[param] = {
              scores: [],
              avgScore: 0,
              totalEvals: 0
            };
          }
          
          if (data.score !== -1) { // Skip irrelevant parameters
            parameterScores[param].scores.push(data.score);
            parameterScores[param].totalEvals++;
          }
        });
      }
    });
    
    // Calculate averages
    Object.keys(parameterScores).forEach(param => {
      const { scores, totalEvals } = parameterScores[param];
      parameterScores[param].avgScore = totalEvals > 0 
        ? (scores.reduce((sum, score) => sum + score, 0) / totalEvals).toFixed(2)
        : 0;
    });
    
    // Get overall stats
    const totalEvaluations = evaluations.length;
    const avgScore = totalEvaluations > 0
      ? evaluations.reduce((sum, eval) => sum + (eval.evaluationData?.evaluation?.totalScore || 0), 0) / totalEvaluations
      : 0;
      
    // Format response
    const response = {
      agentId,
      agentName: evaluations[0]?.interactionData?.agent?.name || 'Unknown',
      totalEvaluations,
      avgScore,
      improvementAreas: Object.entries(areasOfImprovement)
        .sort((a, b) => b[1] - a[1])
        .map(([area, count]) => ({ area, count })),
      strengths: Object.entries(strengths)
        .sort((a, b) => b[1] - a[1])
        .map(([strength, count]) => ({ strength, count })),
      parameters: Object.entries(parameterScores)
        .sort((a, b) => parseFloat(a[1].avgScore) - parseFloat(b[1].avgScore)) // Sort by ascending score (worst first)
        .map(([param, data]) => ({
          parameter: param,
          avgScore: parseFloat(data.avgScore),
          evaluationCount: data.totalEvals
        }))
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error getting coaching insights:', error);
    res.status(500).json({ message: 'Error getting coaching insights', error: error.message });
  }
});

module.exports = router;