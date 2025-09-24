// routes/analytics.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { InteractionAIQA } = require('../config/mongodb');
const { format } = require('date-fns');

router.use(authenticateToken);

// Get agent comparison data
router.get('/agent-comparison', async (req, res) => {
  try {
    const { startDate, endDate, agentsData, parameters, formId, channels } = req.query;

    let agents = agentsData;

    if (!req.user.isAdmin && req.user.agentId) {
      agents = req.user.agentId.toString();
      
      // Inform frontend that this is a restricted view
      res.set('X-Restricted-View', 'agent-only');
    }
    
    console.log('Agent Comparison Request:', { startDate, endDate, agents, parameters });
    
    const query = {};
    
    // routes/analytics.js - Update the date handling in agent-comparison endpoint

    if (formId) {
      query.qaFormId = formId;
    }

    if (startDate && endDate) {
        try {
        // Convert string dates to Date objects
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // Validate the dates
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            // Set end date to end of day
            end.setHours(23, 59, 59, 999);
            
            console.log(`Date range: ${start.toISOString()} to ${end.toISOString()}`);
            
            // Use proper Date objects in the query
            query.createdAt = {
            $gte: start,
            $lte: end
            };
        } else {
            console.warn('Invalid date format in request:', { startDate, endDate });
        }
        } catch (err) {
        console.warn('Error processing dates:', err.message);
        }
    }
    
    if (agents) {
      // Try both string and number comparisons for agent IDs
      const agentIds = agents.split(',');
      query["interactionData.agent.id"] = { 
        $in: [...agentIds, ...agentIds.map(id => parseInt(id))] 
      };
    }
    
    if (channels) {
      const channelList = channels.split(',');
      query["interactionData.channel"] = { $in: channelList };
      console.log('Filtering by channels:', channelList);
    }

    console.log('MongoDB Query:', JSON.stringify(query));
    
    // First check if we have any evaluations at all
    const totalCount = await InteractionAIQA.countDocuments();
    console.log('Total evaluations in database:', totalCount);
    
    // Then check if our query matches anything
    const matchCount = await InteractionAIQA.countDocuments(query);
    console.log('Matching evaluations:', matchCount);
    
    // Get the evaluations - if none match, get recent ones
    const evaluations = matchCount > 0 
      ? await InteractionAIQA.find(query).sort({ createdAt: -1 }).lean()
      : await InteractionAIQA.find({}).limit(100).sort({ createdAt: -1 }).lean();
    
    console.log(`Processing ${evaluations.length} evaluations`);
    
    // Group by agent
    const agentData = {};
    
    evaluations.forEach(eval => {
      const agentId = eval.interactionData?.agent?.id;
      const agentName = eval.interactionData?.agent?.name;
      
      if (!agentId) return;
      
      if (!agentData[agentId]) {
        agentData[agentId] = {
          id: agentId,
          name: agentName || 'Unknown',
          evaluationCount: 0,
          totalScore: 0,
          avgScore: 0,
          parameters: {},
          sentiments: {
            positive: 0,
            neutral: 0,
            negative: 0
          }
        };
      }
      
      agentData[agentId].evaluationCount++;
      agentData[agentId].totalScore += eval.evaluationData?.evaluation?.totalScore || 0;
      
      // Track sentiments
      const sentiment = Array.isArray(eval.evaluationData?.evaluation?.customerSentiment)
        ? eval.evaluationData?.evaluation?.customerSentiment[0]
        : eval.evaluationData?.evaluation?.customerSentiment;
        
      if (sentiment) {
        agentData[agentId].sentiments[sentiment] = 
          (agentData[agentId].sentiments[sentiment] || 0) + 1;
      }
      
      // Track parameter scores
      if (eval.evaluationData?.evaluation?.parameters) {
        Object.entries(eval.evaluationData.evaluation.parameters).forEach(([param, data]) => {
          if (data.score === -1) return; // Skip irrelevant parameters
          
          if (!agentData[agentId].parameters[param]) {
            agentData[agentId].parameters[param] = {
              scores: [],
              avgScore: 0
            };
          }
          
          agentData[agentId].parameters[param].scores.push(data.score);
        });
      }
    });
    
    // Calculate averages
    Object.values(agentData).forEach(agent => {
      agent.avgScore = agent.evaluationCount > 0
        ? (agent.totalScore / agent.evaluationCount).toFixed(2)
        : 0;
        
      // Calculate parameter averages
      Object.keys(agent.parameters).forEach(param => {
        const scores = agent.parameters[param].scores;
        agent.parameters[param].avgScore = scores.length > 0
          ? (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2)
          : 0;
      });
    });
    
    // Convert to array for response
    const response = Object.values(agentData);
    
    // If specific parameters were requested, filter them
    if (parameters) {
      const paramList = parameters.split(',');
      response.forEach(agent => {
        agent.parameters = Object.entries(agent.parameters)
          .filter(([param]) => paramList.includes(param))
          .reduce((obj, [param, data]) => {
            obj[param] = data;
            return obj;
          }, {});
      });
    }
    
    // Add warning if we fell back to all evaluations
    const result = matchCount === 0 && totalCount > 0
      ? { warning: "No evaluations matched your filters. Showing all evaluations instead.", data: response }
      : response;
    
    if (!req.user.isAdmin && req.user.agentId) {
      if (Array.isArray(result)) {
        res.json({
          data: result,
          isRestrictedView: true
        });
      } else {
        result.isRestrictedView = true;
        res.json(result);
      }
    } else {
      res.json(result);
    }
    //res.json(result);
  } catch (error) {
    console.error('Error getting agent comparison:', error);
    res.status(500).json({ message: 'Error getting agent comparison', error: error.message });
  }
});

// Get trend analysis data
router.get('/trends', async (req, res) => {
  try {
    const { startDate, endDate, agentIdentification, queueId, interval = 'day', formId, channelId } = req.query;
    
    let agentId = agentIdentification;

    if (!req.user.isAdmin && req.user.agentId) {
      agentId = req.user.agentId.toString();
      
      // Inform frontend that this is a restricted view
      res.set('X-Restricted-View', 'agent-only');
    }

    console.log('Trend Analysis Request:', { startDate, endDate, agentId, queueId, interval: 'day', formId, channelId });
    
    const query = {};
    
    if (formId) {
      query.qaFormId = formId;
    }

    if (startDate && endDate) {
        try {
        // Convert string dates to Date objects
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // Validate the dates
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            // Set end date to end of day
            end.setHours(23, 59, 59, 999);
            
            console.log(`Date range: ${start.toISOString()} to ${end.toISOString()}`);
            
            // Use proper Date objects in the query
            query.createdAt = {
            $gte: start,
            $lte: end
            };
        } else {
            console.warn('Invalid date format in request:', { startDate, endDate });
        }
        } catch (err) {
        console.warn('Error processing dates:', err.message);
        }
    }
    
    if (agentId) {
      // Handle both string and number IDs
      query["interactionData.agent.id"] = { $in: [agentId, parseInt(agentId)] };
    }
    
    if (queueId) {
      // Handle both string and number IDs
      query["interactionData.queue.id"] = { $in: [queueId, parseInt(queueId)] };
    }
    
    if (channelId) {
      const channelList = [channelId];
      query["interactionData.channel"] = { $in: channelList };
      console.log('Filtering by channels:', channelList);
    }

    console.log('MongoDB Query:', JSON.stringify(query));
    
    // Check if we have any evaluations
    const totalCount = await InteractionAIQA.countDocuments();
    console.log('Total evaluations in database:', totalCount);
    
    // Check if our query matches anything
    const matchCount = await InteractionAIQA.countDocuments(query);
    console.log('Matching evaluations:', matchCount);
    
    // Get evaluations - if none match, get recent ones
    const evaluations = matchCount > 0
      ? await InteractionAIQA.find(query).sort({ createdAt: 1 }).lean()  // Sort by date ascending
      : await InteractionAIQA.find({}).limit(100).sort({ createdAt: -1 }).lean();
    
    console.log(`Processing ${evaluations.length} evaluations for trend analysis`);
    
    // Group by time interval
    const trends = {};
    
    evaluations.forEach(eval => {
      let date = new Date(eval.createdAt);
      let key;
      
      // Format date based on interval
      if (interval === 'day') {
        key = format(date, 'yyyy-MM-dd');
      } else if (interval === 'week') {
        // Get the start of the week (Monday)
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        key = format(new Date(date.setDate(diff)), 'yyyy-MM-dd');
      } else if (interval === 'month') {
        key = format(date, 'yyyy-MM');
      }
      
      if (!trends[key]) {
        trends[key] = {
          date: key,
          count: 0,
          totalScore: 0,
          avgScore: 0,
          customerSentiment: {
            positive: 0,
            neutral: 0,
            negative: 0
          },
          parameters: {},
          channels: {}
        };
      }
      
      trends[key].count++;
      trends[key].totalScore += eval.evaluationData?.evaluation?.totalScore || 0;
      
      if (eval.interactionData) {
        const channel = eval.interactionData.channel || 'call';
        if (!trends[key].channels[channel]) {
          trends[key].channels[channel] = 0;
        }
        trends[key].channels[channel]++;
      }

      // Track sentiments
      const sentiment = Array.isArray(eval.evaluationData?.evaluation?.customerSentiment)
        ? eval.evaluationData?.evaluation?.customerSentiment[0]
        : eval.evaluationData?.evaluation?.customerSentiment;
        
      if (sentiment) {
        trends[key].customerSentiment[sentiment]++;
      }
      
      // Track parameter scores
      if (eval.evaluationData?.evaluation?.parameters) {
        Object.entries(eval.evaluationData.evaluation.parameters).forEach(([param, data]) => {
          if (data.score === -1) return; // Skip irrelevant parameters
          
          if (!trends[key].parameters[param]) {
            trends[key].parameters[param] = {
              scores: [],
              avgScore: 0
            };
          }
          
          trends[key].parameters[param].scores.push(data.score);
        });
      }
    });
    
    // Calculate averages and format
    const result = Object.values(trends).map(period => {
      period.avgScore = period.count > 0
        ? (period.totalScore / period.count).toFixed(2)
        : 0;
        
      // Calculate parameter averages
      Object.keys(period.parameters).forEach(param => {
        const scores = period.parameters[param].scores;
        period.parameters[param].avgScore = scores.length > 0
          ? (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2)
          : 0;
      });
      
      return period;
    });
    
    // Sort by date
    result.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Add warning if we fell back to all evaluations
    const response = matchCount === 0 && totalCount > 0
      ? { warning: "No evaluations matched your filters. Showing recent evaluation trends instead.", data: result }
      : result;
    
    if (!req.user.isAdmin && req.user.agentId) {
      if (Array.isArray(response)) {
        res.json({
          data: response,
          isRestrictedView: true
        });
      } else {
        response.isRestrictedView = true;
        res.json(response);
      }
    } else {
      res.json(response);
    }
  } catch (error) {
    console.error('Error getting trend data:', error);
    res.status(500).json({ message: 'Error getting trend data', error: error.message });
  }
});

module.exports = router;