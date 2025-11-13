// routes/billing.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { InteractionAIQA, Interactions } = require('../config/mongodb');
const mongoose = require('mongoose');

// Apply authentication to all routes
router.use(authenticateToken);

// Get billing and usage statistics
router.get('/usage', async (req, res) => {
  try {
    // Only admins should access billing data
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Access denied: Admin rights required' });
    }

    // Extract date range from query params, default to current month
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(1)); // Start of current month
    const end = endDate ? new Date(endDate) : new Date();
    
    // Set to beginning of the day for start date and end of day for end date
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    // Get all evaluations in the date range
    const evaluations = await InteractionAIQA.find({
      createdAt: { $gte: start, $lte: end }
    }).lean();

    const { ContextGeneratorUsage } = require('../config/mongodb');
    const contextGeneratorUsage = await ContextGeneratorUsage.find({
      timestamp: { $gte: start, $lte: end }
    }).lean();


    console.log(`Found ${evaluations.length} evaluations between ${start.toISOString()} and ${end.toISOString()}`);

    // Get environment variables for costs
    const costSttPrerecorded = parseFloat(process.env.COST_STT_PRERECORDED || 0.0052);
    const costOpenAiInput = parseFloat(process.env.COST_OPENAI_GPT4O_INPUT || 0.00005);
    const costOpenAiOutput = parseFloat(process.env.COST_OPENAI_GPT4O_OUTPUT || 0.00015);
    const costAiContextGenerator = parseFloat(process.env.COST_AI_CONTEXT_GENERATOR || 0.00025);
    const priceSttPrerecorded = parseFloat(process.env.PRICE_STT_PRERECORDED || 0.0065);
    const priceOpenAiInput = parseFloat(process.env.PRICE_OPENAI_GPT4O_INPUT || 0.0000625);
    const priceOpenAiOutput = parseFloat(process.env.PRICE_OPENAI_GPT4O_OUTPUT || 0.0001875);
    const priceAiContextGenerator = parseFloat(process.env.PRICE_AI_CONTEXT_GENERATOR || 0.0003125);

    // Initialize counters
    let totalUsage = {
      evaluationCount: evaluations.length,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      totalDuration: 0, // in seconds
      aiContextGeneratorUses: contextGeneratorUsage.length,
      costBreakdown: {
        stt: 0,
        openAiInput: 0,
        openAiOutput: 0,
        aiContextGenerator: 0,
        total: 0
      },
      priceBreakdown: {
        stt: 0,
        openAiInput: 0,
        openAiOutput: 0,
        aiContextGenerator: 0,
        total: 0
      },
      byAgent: {},
      byQueue: {},
      dailyUsage: {}
    };

    // Process each evaluation
    for (const evaluation of evaluations) {
      // Get token usage
      const usage = evaluation.evaluationData?.usage || {};
      const promptTokens = usage.prompt_tokens || 0;
      const completionTokens = usage.completion_tokens || 0;
      const totalTokens = usage.total_tokens || promptTokens + completionTokens;
      
      // Get call duration from interaction data or evaluation data
      const callDuration = evaluation.interactionData?.duration || 0; // in seconds
      
      // Add to totals
      totalUsage.promptTokens += promptTokens;
      totalUsage.completionTokens += completionTokens;
      totalUsage.totalTokens += totalTokens;
      totalUsage.totalDuration += callDuration;
      
      // Calculate costs for this evaluation
      const sttCost = (callDuration / 60) * costSttPrerecorded; // Convert to minutes
      const openAiInputCost = promptTokens * costOpenAiInput;
      const openAiOutputCost = completionTokens * costOpenAiOutput;
      const totalCost = sttCost + openAiInputCost + openAiOutputCost;
      
      // Calculate prices for this evaluation
      const sttPrice = (callDuration / 60) * priceSttPrerecorded; // Convert to minutes
      const openAiInputPrice = promptTokens * priceOpenAiInput;
      const openAiOutputPrice = completionTokens * priceOpenAiOutput;
      const totalPrice = sttPrice + openAiInputPrice + openAiOutputPrice;
      
      const aiContextTotalCost = contextGeneratorUsage.reduce((sum, usage) => sum + usage.cost, 0);
      const aiContextTotalPrice = contextGeneratorUsage.reduce((sum, usage) => sum + usage.price, 0);

      // Add to cost breakdown
      totalUsage.costBreakdown.stt += sttCost;
      totalUsage.costBreakdown.openAiInput += openAiInputCost;
      totalUsage.costBreakdown.openAiOutput += openAiOutputCost;
      totalUsage.costBreakdown.total += totalCost;
      totalUsage.costBreakdown.aiContextGenerator = aiContextTotalCost;
      totalUsage.costBreakdown.total += aiContextTotalCost;
      
      // Add to price breakdown
      totalUsage.priceBreakdown.stt += sttPrice;
      totalUsage.priceBreakdown.openAiInput += openAiInputPrice;
      totalUsage.priceBreakdown.openAiOutput += openAiOutputPrice;
      totalUsage.priceBreakdown.total += totalPrice;
      totalUsage.priceBreakdown.aiContextGenerator = aiContextTotalPrice;
      totalUsage.priceBreakdown.total += aiContextTotalPrice;
      
      // Group by agent
      const agentId = evaluation.interactionData?.agent?.id || 'unknown';
      const agentName = evaluation.interactionData?.agent?.name || 'Unknown Agent';
      
      if (!totalUsage.byAgent[agentId]) {
        totalUsage.byAgent[agentId] = {
          agentId,
          name: agentName,
          evaluationCount: 0,
          totalTokens: 0,
          totalDuration: 0,
          totalCost: 0,
          totalPrice: 0
        };
      }
      
      totalUsage.byAgent[agentId].evaluationCount++;
      totalUsage.byAgent[agentId].totalTokens += totalTokens;
      totalUsage.byAgent[agentId].totalDuration += callDuration;
      totalUsage.byAgent[agentId].totalCost += totalCost;
      totalUsage.byAgent[agentId].totalPrice += totalPrice;
      
      // Group by queue
      const queueId = evaluation.interactionData?.queue?.id || 'unknown';
      const queueName = evaluation.interactionData?.queue?.name || 'Unknown Queue';
      
      if (!totalUsage.byQueue[queueId]) {
        totalUsage.byQueue[queueId] = {
          queueId,
          name: queueName,
          evaluationCount: 0,
          totalTokens: 0,
          totalDuration: 0,
          totalCost: 0,
          totalPrice: 0
        };
      }
      
      totalUsage.byQueue[queueId].evaluationCount++;
      totalUsage.byQueue[queueId].totalTokens += totalTokens;
      totalUsage.byQueue[queueId].totalDuration += callDuration;
      totalUsage.byQueue[queueId].totalCost += totalCost;
      totalUsage.byQueue[queueId].totalPrice += totalPrice;
      
      // Group by day
      const day = new Date(evaluation.createdAt).toISOString().split('T')[0];
      
      if (!totalUsage.dailyUsage[day]) {
        totalUsage.dailyUsage[day] = {
          date: day,
          evaluationCount: 0,
          totalTokens: 0,
          totalDuration: 0,
          totalCost: 0,
          totalPrice: 0
        };
      }
      
      totalUsage.dailyUsage[day].evaluationCount++;
      totalUsage.dailyUsage[day].totalTokens += totalTokens;
      totalUsage.dailyUsage[day].totalDuration += callDuration;
      totalUsage.dailyUsage[day].totalCost += totalCost;
      totalUsage.dailyUsage[day].totalPrice += totalPrice;
    }
    
    // Convert agent and queue objects to arrays for easier frontend processing
    totalUsage.byAgent = Object.values(totalUsage.byAgent).sort((a, b) => b.totalCost - a.totalCost);
    totalUsage.byQueue = Object.values(totalUsage.byQueue).sort((a, b) => b.totalCost - a.totalCost);
    
    // Convert daily usage to sorted array
    totalUsage.dailyUsage = Object.values(totalUsage.dailyUsage).sort((a, b) => a.date.localeCompare(b.date));
    
    for (const usage of contextGeneratorUsage) {
      const day = new Date(usage.timestamp).toISOString().split('T')[0];
      
      if (!totalUsage.dailyUsage[day]) {
        totalUsage.dailyUsage[day] = {
          date: day,
          evaluationCount: 0,
          totalTokens: 0,
          totalDuration: 0,
          aiContextUses: 0,
          totalCost: 0,
          totalPrice: 0
        };
      }
      
      totalUsage.dailyUsage[day].aiContextUses = (totalUsage.dailyUsage[day].aiContextUses || 0) + 1;
      totalUsage.dailyUsage[day].totalCost += usage.cost;
      totalUsage.dailyUsage[day].totalPrice += usage.price;
    }

    // Add cost rates to the response
    totalUsage.rates = {
      costSttPrerecorded,
      costOpenAiInput,
      costOpenAiOutput,
      costAiContextGenerator,
      priceSttPrerecorded,
      priceOpenAiInput,
      priceOpenAiOutput,
      priceAiContextGenerator
    };

    // Return the usage statistics
    res.json(totalUsage);
  } catch (error) {
    console.error('Error fetching billing data:', error);
    res.status(500).json({ message: 'Error fetching billing data', error: error.message });
  }
});

// Update the cost model for an evaluation (admin only)
router.post('/update-evaluation-cost/:id', authenticateToken, async (req, res) => {
  try {
    // Only admins should be able to update costs
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Access denied: Admin rights required' });
    }
    
    const { id } = req.params;
    const { costData } = req.body;
    
    // Validate input
    if (!costData) {
      return res.status(400).json({ message: 'Cost data is required' });
    }
    
    // Find the evaluation
    const evaluation = await InteractionAIQA.findById(id);
    if (!evaluation) {
      return res.status(404).json({ message: 'Evaluation not found' });
    }
    
    // Update cost data
    if (!evaluation.costModel) {
      evaluation.costModel = {};
    }
    
    evaluation.costModel = {
      ...evaluation.costModel,
      ...costData,
      updatedAt: new Date(),
      updatedBy: req.user.username || req.user.id
    };
    
    // Save the evaluation
    await evaluation.save();
    
    res.json({ message: 'Cost data updated successfully', evaluation });
  } catch (error) {
    console.error('Error updating evaluation cost data:', error);
    res.status(500).json({ message: 'Error updating cost data', error: error.message });
  }
});

router.get('/rates', authenticateToken, async (req, res) => {
  try {
    // Only admins should view billing rates
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Access denied: Admin rights required' });
    }

    // Return rates for all transcription providers
    const rates = {
      // AssemblyAI rates
      costSttAssemblyAIUniversal: parseFloat(process.env.COST_STT_ASSEMBLYAI_UNIVERSAL || 0.0025),
      priceSttAssemblyAIUniversal: parseFloat(process.env.PRICE_STT_ASSEMBLYAI_UNIVERSAL || 0.003125),
      costSttAssemblyAINano: parseFloat(process.env.COST_STT_ASSEMBLYAI_NANO || 0.0015),
      priceSttAssemblyAINano: parseFloat(process.env.PRICE_STT_ASSEMBLYAI_NANO || 0.001875),
      
      // OpenAI Whisper rates
      costSttOpenAIWhisper: parseFloat(process.env.COST_STT_OPENAI_WHISPER || 0.006),
      priceSttOpenAIWhisper: parseFloat(process.env.PRICE_STT_OPENAI_WHISPER || 0.0075),
      costSttOpenAIGPT4O: parseFloat(process.env.COST_STT_OPENAI_GPT4O || 0.006),
      priceSttOpenAIGPT4O: parseFloat(process.env.PRICE_STT_OPENAI_GPT4O || 0.0075),
      costSttOpenAIGPT4OMini: parseFloat(process.env.COST_STT_OPENAI_GPT4O_MINI || 0.003),
      priceSttOpenAIGPT4OMini: parseFloat(process.env.PRICE_STT_OPENAI_GPT4O_MINI || 0.00375),
      
      // Deepgram rates (legacy)
      costSttPrerecorded: parseFloat(process.env.COST_STT_PRERECORDED || 0.0052),
      priceSttPrerecorded: parseFloat(process.env.PRICE_STT_PRERECORDED || 0.0065),
      
      // OpenAI GPT-4o rates (for evaluation)
      costOpenAiInput: parseFloat(process.env.COST_OPENAI_GPT4O_INPUT || 0.00005),
      costOpenAiOutput: parseFloat(process.env.COST_OPENAI_GPT4O_OUTPUT || 0.00015),
      priceOpenAiInput: parseFloat(process.env.PRICE_OPENAI_GPT4O_INPUT || 0.0000625),
      priceOpenAiOutput: parseFloat(process.env.PRICE_OPENAI_GPT4O_OUTPUT || 0.0001875),
      
      // AI Context Generator rates
      costAiContextGenerator: parseFloat(process.env.COST_AI_CONTEXT_GENERATOR || 0.00025),
      priceAiContextGenerator: parseFloat(process.env.PRICE_AI_CONTEXT_GENERATOR || 0.0003125),
      
      // Current provider configuration
      currentProvider: process.env.TRANSCRIPTION_PROVIDER || 'assemblyai'
    };

    res.json(rates);
  } catch (error) {
    console.error('Error getting billing rates:', error);
    res.status(500).json({ message: 'Error getting billing rates' });
  }
});

// NOTE: Replace the existing router.get('/rates', ...) endpoint in routes/billing.js with the code above
  
module.exports = router;