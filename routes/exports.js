// routes/exports.js - Updated to include form parameters in CSV exports
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { InteractionAIQA } = require('../config/mongodb');
const { format } = require('date-fns');

router.use(authenticateToken);

// Export evaluations to CSV
router.get('/evaluations', async (req, res) => {
  try {
    const { startDate, endDate, agentId, queueId, channel, format: formatType = 'csv', formId, includeParameters } = req.query;
    
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
      query['interactionData.agent.id'] = agentId;
    }
    
    if (queueId) {
      query['interactionData.queue.id'] = queueId;
    }
    
    // ADD: Channel filter
    if (channel) {
      query['interactionData.channel'] = channel;
      console.log(`Filtering by channel: ${channel}`);
    }
    
    console.log('Export query:', JSON.stringify(query, null, 2));
    
    const evaluations = await InteractionAIQA.find(query)
      .sort({ createdAt: -1 })
      .lean();

    console.log(`Found ${evaluations.length} evaluations to export`);

    // Parse the includeParameters string if provided
    const parametersToInclude = includeParameters ? includeParameters.split(',') : [];
      
    if (formatType === 'csv') {
      // Generate CSV
      // Start with basic headers
      const csvHeader = [
        'Evaluation ID',
        'Date',
        'Agent',
        'Queue',
        'Channel',
        'Duration',
        'Overall Score',
        'Max Score',
        'Customer Sentiment',
        'Agent Sentiment',
        'Areas of Improvement',
        'Strengths',
        'Summary'
      ];
      
      // Add parameter headers if requested
      if (parametersToInclude.length > 0) {
        csvHeader.push(...parametersToInclude);
      }
      
      const csvRows = evaluations.map(eval => {
        // Create base row with standard fields
        const baseRow = [
          eval._id,
          format(new Date(eval.createdAt), 'yyyy-MM-dd HH:mm:ss'),
          eval.interactionData?.agent?.name || 'Unknown',
          eval.interactionData?.queue?.name || 'Unknown',
          eval.interactionData?.channel || 'voice',
          eval.interactionData?.duration || 0,
          eval.evaluationData?.evaluation?.totalScore || 0,
          eval.evaluationData?.evaluation?.maxScore || 0,
          Array.isArray(eval.evaluationData?.evaluation?.customerSentiment) 
            ? eval.evaluationData.evaluation.customerSentiment.join(', ') 
            : (eval.evaluationData?.evaluation?.customerSentiment || 'neutral'),
          Array.isArray(eval.evaluationData?.evaluation?.agentSentiment) 
            ? eval.evaluationData.evaluation.agentSentiment.join(', ') 
            : (eval.evaluationData?.evaluation?.agentSentiment || 'neutral'),
          (eval.evaluationData?.evaluation?.areasOfImprovements || []).join('; '),
          (eval.evaluationData?.evaluation?.whatTheAgentDidWell || []).join('; '),
          eval.evaluationData?.evaluation?.summary || ''
        ];

        // Add parameter scores if requested
        if (parametersToInclude.length > 0) {
          parametersToInclude.forEach(paramName => {
            const paramData = eval.evaluationData?.evaluation?.parameters?.[paramName];
            // Format the parameter score nicely, or indicate if not available
            let paramValue = 'N/A';
            
            if (paramData) {
              // Skip parameters marked as not relevant
              if (paramData.score === -1) {
                paramValue = 'Not Relevant';
              } else {
                paramValue = paramData.score;
                
                // Add explanation if available (optional)
                if (paramData.explanation) {
                  paramValue = `${paramValue} - ${paramData.explanation}`;
                }
              }
            }
            
            baseRow.push(paramValue);
          });
        }
        
        return baseRow;
      });
      
      const csvContent = [
        csvHeader.join(','),
        ...csvRows.map(row => row.map(value => 
          // Escape quotes and wrap values with quotes
          `"${String(value).replace(/"/g, '""')}"`
        ).join(','))
      ].join('\n');
      
      // Set response headers
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="evaluations-export.csv"');
      
      // Send CSV content
      res.send(csvContent);
    } else {
      // Handle other formats if needed (JSON is default)
      res.json(evaluations);
    }
  } catch (error) {
    console.error('Error exporting evaluations:', error);
    res.status(500).json({ message: 'Error exporting evaluations' });
  }
});

// Export agent performance report
router.get('/agent-performance', async (req, res) => {
  try {
    const { startDate, endDate, channel, format: formatType = 'csv', formId, includeParameters } = req.query;
    
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
    
    // ADD: Channel filter
    if (channel) {
      query['interactionData.channel'] = channel;
      console.log(`Filtering by channel: ${channel}`);
    }
    
    console.log('Export query:', JSON.stringify(query, null, 2));
    
    const evaluations = await InteractionAIQA.find(query)
      .sort({ createdAt: -1 })
      .lean();
      
    console.log(`Found ${evaluations.length} evaluations for agent performance`);
      
    // Group by agent
    const agentData = {};
    
    evaluations.forEach(eval => {
      const agentId = eval.interactionData?.agent?.id;
      const agentName = eval.interactionData?.agent?.name;
      const evalChannel = eval.interactionData?.channel || 'voice';
      
      if (!agentId) return;
      
      if (!agentData[agentId]) {
        agentData[agentId] = {
          id: agentId,
          name: agentName || 'Unknown',
          evaluationCount: 0,
          totalScore: 0,
          avgScore: 0,
          sentiments: {
            positive: 0,
            neutral: 0,
            negative: 0
          },
          channels: {}, // Track channel breakdown
          parameters: {},
          areasOfImprovement: {}
        };
      }
      
      agentData[agentId].evaluationCount++;
      agentData[agentId].totalScore += eval.evaluationData?.evaluation?.totalScore || 0;
      
      // Track channel breakdown
      if (!agentData[agentId].channels[evalChannel]) {
        agentData[agentId].channels[evalChannel] = 0;
      }
      agentData[agentId].channels[evalChannel]++;
      
      // Track sentiments
      const sentiment = Array.isArray(eval.evaluationData?.evaluation?.customerSentiment)
        ? eval.evaluationData?.evaluation?.customerSentiment[0]
        : eval.evaluationData?.evaluation?.customerSentiment;
        
      if (sentiment && agentData[agentId].sentiments.hasOwnProperty(sentiment)) {
        agentData[agentId].sentiments[sentiment]++;
      }
      
      // Track areas of improvement
      if (eval.evaluationData?.evaluation?.areasOfImprovements) {
        eval.evaluationData.evaluation.areasOfImprovements.forEach(area => {
          agentData[agentId].areasOfImprovement[area] = 
            (agentData[agentId].areasOfImprovement[area] || 0) + 1;
        });
      }
      
      // Track parameter scores
      if (eval.evaluationData?.evaluation?.parameters) {
        Object.entries(eval.evaluationData.evaluation.parameters).forEach(([param, data]) => {
          if (!data || data.score === -1) return; // Skip irrelevant parameters
          
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
    
    // Format result as array
    const result = Object.values(agentData);
    
    // Parse the includeParameters string if provided
    const parametersToInclude = includeParameters ? includeParameters.split(',') : [];
    
    if (formatType === 'csv') {
      // Generate CSV for agent performance
      // Start with basic header fields
      const csvHeader = [
        'Agent ID',
        'Agent Name',
        'Evaluations',
        'Average Score',
        'Positive Sentiment %',
        'Neutral Sentiment %',
        'Negative Sentiment %',
        'Top Issues',
        'Channels' // Add channels summary
      ];
      
      // Add parameters as columns if requested
      if (parametersToInclude.length > 0) {
        csvHeader.push(...parametersToInclude);
      } else {
        // If no specific parameters requested, include all parameters found
        const allParameters = new Set();
        result.forEach(agent => {
          Object.keys(agent.parameters).forEach(param => {
            allParameters.add(param);
          });
        });
        csvHeader.push(...Array.from(allParameters));
      }
      
      const csvRows = result.map(agent => {
        const sentimentTotal = agent.sentiments.positive + agent.sentiments.neutral + agent.sentiments.negative;
        const positivePct = sentimentTotal > 0 ? (agent.sentiments.positive / sentimentTotal * 100).toFixed(2) : 0;
        const neutralPct = sentimentTotal > 0 ? (agent.sentiments.neutral / sentimentTotal * 100).toFixed(2) : 0;
        const negativePct = sentimentTotal > 0 ? (agent.sentiments.negative / sentimentTotal * 100).toFixed(2) : 0;
        
        // Get top 3 issues
        const topIssues = Object.entries(agent.areasOfImprovement)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([issue, count]) => `${issue} (${count})`)
          .join('; ');
          
        // Format channels breakdown
        const channelsBreakdown = Object.entries(agent.channels)
          .map(([channel, count]) => `${channel}: ${count}`)
          .join(', ');
          
        // Base row data
        const row = [
          agent.id,
          agent.name,
          agent.evaluationCount,
          agent.avgScore,
          positivePct,
          neutralPct,
          negativePct,
          topIssues,
          channelsBreakdown
        ];
        
        // Add parameter scores
        const parameters = parametersToInclude.length > 0 
          ? parametersToInclude 
          : csvHeader.slice(9); // Skip first 9 headers which are not parameters
          
        parameters.forEach(param => {
          row.push(agent.parameters[param]?.avgScore || 0);
        });
        
        return row;
      });
      
      const csvContent = [
        csvHeader.join(','),
        ...csvRows.map(row => row.map(value => 
          `"${String(value).replace(/"/g, '""')}"`
        ).join(','))
      ].join('\n');
      
      // Set response headers
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="agent-performance.csv"');
      
      // Send CSV content
      res.send(csvContent);
    } else {
      // Handle other formats (JSON is default)
      res.json(result);
    }
  } catch (error) {
    console.error('Error exporting agent performance:', error);
    res.status(500).json({ message: 'Error exporting agent performance' });
  }
});

module.exports = router;