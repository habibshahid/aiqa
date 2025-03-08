// services/analyticsService.js
const { InteractionAIQA, Interactions } = require('../config/mongodb');
const mongoose = require('mongoose');

/**
 * Get QA evaluation metrics for dashboard
 * @param {Object} filters - Query filters
 * @returns {Promise<Object>} Metrics for dashboard
 */
const getEvaluationMetrics = async (filters = {}) => {
  try {
    console.log('Getting evaluation metrics with filters:', filters);
    
    // Base query for evaluations
    let query = {};
    
    // Apply filters
    if (filters.agentId) {
      query['interactionData.agent.id'] = filters.agentId;
    }
    
    if (filters.queueId) {
      query['interactionData.queue.id'] = filters.queueId;
    }
    
    if (filters.dateRange) {
      const startDate = new Date(filters.dateRange.start);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(filters.dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      
      query.createdAt = {
        $gte: startDate,
        $lte: endDate
      };
    }
    
    if (filters.formId) {
      query.qaFormId = filters.formId;
    }
    
    console.log('Final query:', JSON.stringify(query));
    
    // Get evaluations
    const evaluations = await InteractionAIQA.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    
    console.log(`Found ${evaluations.length} evaluations`);

    if (evaluations.length === 0) {
      return {
        totalEvaluations: 0,
        agentPerformance: [],
        bestPerformer: null,
        poorPerformer: null,
        averageCustomerSentiment: 'N/A',
        areasNeedingFocus: [],
        recentEvaluations: [],
        parameterAnalysis: [],
        dateRange: filters.dateRange
      };
    }
    
    // Process evaluations for metrics
    
    // Count evaluations by agent and calculate average scores
    const agentScores = {};
    let totalScore = 0;
    
    for (const eval of evaluations) {
      // Extract evaluation data
      const score = eval.evaluationData?.evaluation?.totalScore || 0;
      totalScore += score;
      
      const agent = eval.interactionData?.agent;
      if (agent && agent.id) {
        if (!agentScores[agent.id]) {
          agentScores[agent.id] = {
            id: agent.id,
            name: agent.name || 'Unknown',
            totalScore: 0,
            count: 0
          };
        }
        
        agentScores[agent.id].totalScore += score;
        agentScores[agent.id].count += 1;
      }
    }
    
    // Calculate average scores for agents
    const agentPerformance = [];
    let bestPerformer = null;
    let poorPerformer = null;
    let bestScore = -1;
    let worstScore = Number.MAX_VALUE;
    
    for (const agentId in agentScores) {
      const agent = agentScores[agentId];
      const averageScore = Math.round(agent.totalScore / agent.count);
      
      agent.averageScore = averageScore;
      agentPerformance.push({
        name: agent.name,
        id: agent.id,
        averageScore,
        evaluationCount: agent.count // Add count for reference
      });
      
      if (averageScore > bestScore) {
        bestScore = averageScore;
        bestPerformer = { 
          name: agent.name, 
          id: agent.id, 
          averageScore,
          evaluationCount: agent.count 
        };
      }
      
      if (averageScore < worstScore) {
        worstScore = averageScore;
        poorPerformer = { 
          name: agent.name, 
          id: agent.id, 
          averageScore,
          evaluationCount: agent.count 
        };
      }
    }
    
    // Format evaluations for recent list
    const recentEvaluations = evaluations.map(eval => {
      let score = eval.evaluationData?.evaluation?.totalScore || 0;
      let maxScore = eval.evaluationData?.evaluation?.maxScore || 0;
      let scorePerc = (score/maxScore * 100) || 0;
      return {
        id: eval._id,
        score: score,
        maxScore: maxScore,
        scorePerc: scorePerc,
        createdAt: eval.createdAt,
        summary: eval.evaluationData?.evaluation?.summary || '',
        areasOfImprovement: eval.evaluationData?.evaluation?.areasOfImprovements || [],
        customerSentiment: eval.evaluationData?.evaluation?.customerSentiment || [],
        agentSentiment: eval.evaluationData?.evaluation?.agentSentiment || [],
        agent: eval.interactionData?.agent || {},
        duration: eval.interactionData?.duration || 0,
        direction: parseInt(eval.interactionData?.direction) || 0,
        channel: eval.interactionData?.channel || 'call',
        queue: eval.interactionData?.queue || 'Unknown',
        evaluator: { id: '2', name: 'Intellicon Agent' },
        caller: eval.interactionData?.caller || {}
      };
    });
    
    // Extract common areas of improvement
    const allImprovedAreas = [];
    evaluations.forEach(eval => {
      if (eval.evaluationData?.evaluation?.areasOfImprovements) {
        allImprovedAreas.push(...eval.evaluationData.evaluation.areasOfImprovements);
      }
    });
    
    // Count occurrences of each improvement area
    const areaCount = {};
    allImprovedAreas.forEach(area => {
      areaCount[area] = (areaCount[area] || 0) + 1;
    });
    
    // Sort by frequency and get top areas
    const areasNeedingFocus = Object.entries(areaCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => entry[0]);
    
    // Extract agent strengths - add this new code
    const allStrengths = [];
    evaluations.forEach(eval => {
      if (eval.evaluationData?.evaluation?.whatTheAgentDidWell) {
        if (Array.isArray(eval.evaluationData.evaluation.whatTheAgentDidWell)) {
          allStrengths.push(...eval.evaluationData.evaluation.whatTheAgentDidWell);
        } else if (typeof eval.evaluationData.evaluation.whatTheAgentDidWell === 'string') {
          allStrengths.push(eval.evaluationData.evaluation.whatTheAgentDidWell);
        }
      }
    });

    // Count occurrences of each strength
    const strengthCount = {};
    allStrengths.forEach(strength => {
      strengthCount[strength] = (strengthCount[strength] || 0) + 1;
    });

    // Sort by frequency and get top strengths
    const whatTheAgentDidWell = Object.entries(strengthCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => entry[0]);
      
    // Calculate average sentiment
    let customerSentiments = [];
    let agentSentiments = [];
    
    evaluations.forEach(eval => {
      if (eval.evaluationData?.evaluation?.customerSentiment) {
        if (Array.isArray(eval.evaluationData.evaluation.customerSentiment)) {
          customerSentiments.push(eval.evaluationData.evaluation.customerSentiment[0]);
        } else {
          customerSentiments.push(eval.evaluationData.evaluation.customerSentiment);
        }
      }
      
      if (eval.evaluationData?.evaluation?.agentSentiment) {
        if (Array.isArray(eval.evaluationData.evaluation.agentSentiment)) {
          agentSentiments.push(eval.evaluationData.evaluation.agentSentiment[0]);
        } else {
          agentSentiments.push(eval.evaluationData.evaluation.agentSentiment);
        }
      }
    });
    
    // Count sentiment occurrences
    const customerSentimentCount = {
      positive: customerSentiments.filter(s => s === 'positive').length,
      neutral: customerSentiments.filter(s => s === 'neutral').length,
      negative: customerSentiments.filter(s => s === 'negative').length
    };
    
    const agentSentimentCount = {
      positive: agentSentiments.filter(s => s === 'positive').length,
      neutral: agentSentiments.filter(s => s === 'neutral').length,
      negative: agentSentiments.filter(s => s === 'negative').length
    };
    
    // Determine most common sentiment
    let averageCustomerSentiment = 'N/A';
    if (customerSentiments.length > 0) {
      const maxCustomerCount = Math.max(
        customerSentimentCount.positive,
        customerSentimentCount.neutral,
        customerSentimentCount.negative
      );
      
      if (maxCustomerCount === customerSentimentCount.positive) {
        averageCustomerSentiment = 'positive';
      } else if (maxCustomerCount === customerSentimentCount.negative) {
        averageCustomerSentiment = 'negative';
      } else {
        averageCustomerSentiment = 'neutral';
      }
    }
    
    // Process parameter analysis from the first evaluation with parameters
    const parameterEval = evaluations.find(eval => 
      eval.evaluationData?.evaluation?.parameters && 
      Object.keys(eval.evaluationData.evaluation.parameters).length > 0
    );
    
    let parameterAnalysis = [];
    
    if (parameterEval && parameterEval.evaluationData?.evaluation?.parameters) {
      const parameters = parameterEval.evaluationData.evaluation.parameters;
      
      // For each parameter, calculate average score across all evaluations
      for (const [param, data] of Object.entries(parameters)) {
        if (param === 'TotalScore' || param === 'Total Score' || param === 'Score each parameter from 0 to 5') {
          continue;
        }
        
        let totalParamScore = 0;
        let count = 0;
        
        // Sum scores for this parameter across all evaluations
        evaluations.forEach(eval => {
          if (eval.evaluationData?.evaluation?.parameters?.[param]) {
            const score = eval.evaluationData.evaluation.parameters[param].score;
            if (score !== -1) {
              totalParamScore += eval.evaluationData.evaluation.parameters[param].score;
              count++;
            }
          }
        });
        
        const averageScore = count > 0 ? Math.round((totalParamScore / count) * 20) : 0; // Scale to percentage
        
        parameterAnalysis.push({
          parameter: param,
          averageScore,
          count,
          coverage: Math.round((count / evaluations.length) * 100)
        });
      }
    }
    
    // Find highest and lowest score percentages
    let highestScore = 0;
    let lowestScore = 100;
    let highestScoreEval = null;
    let lowestScoreEval = null;

    evaluations.forEach(eval => {
      const score = eval.evaluationData?.evaluation?.totalScore || 0;
      const maxScore = eval.evaluationData?.evaluation?.maxScore || 100;
      const percentage = (score / maxScore) * 100;
      
      if (percentage > highestScore) {
        highestScore = percentage;
        highestScoreEval = {
          id: eval._id,
          score: score,
          maxScore: maxScore,
          percentage: percentage.toFixed(1),
          agent: eval.interactionData?.agent?.name || 'Unknown',
          date: eval.createdAt
        };
      }
      
      if (percentage < lowestScore && percentage > 0) { // Avoid zeros
        lowestScore = percentage;
        lowestScoreEval = {
          id: eval._id,
          score: score,
          maxScore: maxScore,
          percentage: percentage.toFixed(1),
          agent: eval.interactionData?.agent?.name || 'Unknown',
          date: eval.createdAt
        };
      }
    });

    // Analyze intents from evaluations
    const intentCounts = {};
    evaluations.forEach(eval => {
      if (eval.evaluationData?.evaluation?.intent) {
        const intents = Array.isArray(eval.evaluationData.evaluation.intent) 
          ? eval.evaluationData.evaluation.intent 
          : [eval.evaluationData.evaluation.intent];
          
        intents.forEach(intent => {
          if (intent) {
            intentCounts[intent] = (intentCounts[intent] || 0) + 1;
          }
        });
      }
    });

    // Sort intents by count and format for chart
    const intentData = Object.entries(intentCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([intent, count]) => ({
        name: intent,
        count
      }));

    // Count evaluations by QA form
    const formCounts = {};
    evaluations.forEach(evaluation => {
      const formName = evaluation.qaFormName || 'Unknown Form';
      formCounts[formName] = (formCounts[formName] || 0) + 1;
    });

    // Sort forms by count and format for chart
    const formData = Object.entries(formCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([form, count]) => ({
        name: form,
        count
      }));
    
    // Assemble complete metrics object
    const metrics = {
      totalEvaluations: evaluations.length,
      agentPerformance,
      bestPerformer,
      poorPerformer,
      highestScore: highestScoreEval,
      lowestScore: lowestScoreEval,
      averageCustomerSentiment,
      customerSentimentCounts: customerSentimentCount,
      agentSentimentCounts: agentSentimentCount,
      areasNeedingFocus,
      whatTheAgentDidWell,
      recentEvaluations,
      formData,
      intentData,
      summary: evaluations[0]?.evaluationData?.evaluation?.summary || '',
      customerSentiment: customerSentiments.length > 0 ? customerSentiments : [],
      agentSentiment: agentSentiments.length > 0 ? agentSentiments : [],
      totalScore: evaluations.length > 0 ? Math.round(totalScore / evaluations.length) : 0,
      parameterAnalysis,
      dateRange: filters.dateRange,
      totalScore: evaluations.length > 0 ? Math.round(totalScore / evaluations.length) : 0
    };
    
    return metrics;
  } catch (error) {
    console.error('Error getting evaluation metrics:', error);
    // Return empty metrics to avoid breaking the UI
    return {
      totalEvaluations: 0,
      agentPerformance: [],
      bestPerformer: null,
      poorPerformer: null,
      averageCustomerSentiment: 'N/A',
      areasNeedingFocus: [],
      recentEvaluations: [],
      parameterAnalysis: [],
      dateRange: filters.dateRange
    };
  }
};

/**
 * Get filter options for dashboard
 * @returns {Promise<Object>} Options for dashboard filters
 */
const getFilterOptions = async () => {
  try {
    // Get unique agents from interactions
    const interactions = await Interactions.aggregate([
      { $match: { "agent.id": { $exists: true } } },
      { $group: { _id: "$agent.id", name: { $first: "$agent.name" } } },
      { $sort: { name: 1 } },
      { $project: { _id: 0, id: "$_id", name: 1 } }
    ]);
    
    // Get unique queues from interactions
    const queues = await Interactions.aggregate([
      { $match: { "queue.id": { $exists: true } } },
      { $group: { _id: "$queue.id", name: { $first: "$queue.name" } } },
      { $sort: { name: 1 } },
      { $project: { _id: 0, id: "$_id", name: 1 } }
    ]);
    
    return {
      agents: interactions,
      queues
    };
  } catch (error) {
    console.error('Error fetching filter options:', error);
    return {
      agents: [],
      queues: []
    };
  }
};

module.exports = {
  getEvaluationMetrics,
  getFilterOptions
};