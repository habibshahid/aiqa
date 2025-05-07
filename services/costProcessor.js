// services/costProcessor.js
const { InteractionAIQA } = require('../config/mongodb');
const creditService = require('./creditService');

/**
 * Calculate and save cost data for an evaluation
 * @param {string} evaluationId - The ID of the evaluation to process
 * @returns {Promise<Object>} The updated evaluation with cost data
 */
const calculateEvaluationCost = async (evaluationId) => {
  try {
    console.log(`Calculating cost for evaluation ${evaluationId}`);
    
    // Find the evaluation
    const evaluation = await InteractionAIQA.findById(evaluationId);
    if (!evaluation) {
      throw new Error(`Evaluation not found: ${evaluationId}`);
    }
    
    // Get environment variables for costs
    const costSttPrerecorded = parseFloat(process.env.COST_STT_PRERECORDED || 0.0052);
    const costOpenAiInput = parseFloat(process.env.COST_OPENAI_GPT4O_INPUT || 0.00005);
    const costOpenAiOutput = parseFloat(process.env.COST_OPENAI_GPT4O_OUTPUT || 0.00015);
    const priceSttPrerecorded = parseFloat(process.env.PRICE_STT_PRERECORDED || 0.0065);
    const priceOpenAiInput = parseFloat(process.env.PRICE_OPENAI_GPT4O_INPUT || 0.0000625);
    const priceOpenAiOutput = parseFloat(process.env.PRICE_OPENAI_GPT4O_OUTPUT || 0.0001875);
    
    // Get usage data from evaluation
    const usage = evaluation.evaluationData?.usage || {};
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    
    // Get call duration from interaction data
    const callDuration = evaluation.interactionData?.duration || 0; // in seconds
    
    // Calculate costs
    const sttCost = (callDuration / 60) * costSttPrerecorded; // Convert to minutes
    const promptCost = promptTokens * costOpenAiInput;
    const completionCost = completionTokens * costOpenAiOutput;
    const totalCost = sttCost + promptCost + completionCost;
    
    // Calculate prices (what we charge)
    const sttPrice = (callDuration / 60) * priceSttPrerecorded; // Convert to minutes
    const promptPrice = promptTokens * priceOpenAiInput;
    const completionPrice = completionTokens * priceOpenAiOutput;
    const totalPrice = sttPrice + promptPrice + completionPrice;
    
    // Create cost model
    const costModel = {
      sttDuration: callDuration,
      sttCost,
      sttPrice,
      
      promptTokens,
      promptCost,
      promptPrice,
      
      completionTokens,
      completionCost,
      completionPrice,
      
      totalCost,
      totalPrice,
      
      createdAt: new Date()
    };
    
    // Save to evaluation
    evaluation.costModel = costModel;
    await evaluation.save();
    
    console.log(`Cost calculation completed for evaluation ${evaluationId}, total cost: $${totalCost.toFixed(4)}, price: $${totalPrice.toFixed(4)}`);
    
    // Deduct credits based on price
    try {
      const description = `Evaluation: ${evaluationId} - ${callDuration} seconds, ${promptTokens + completionTokens} tokens`;
      const creditResult = await creditService.deductCredits(totalPrice, evaluationId, description);
      
      console.log(`Credits deducted for evaluation ${evaluationId}:`, creditResult);
      
      // If balance is low, log a warning
      if (creditResult.is_low) {
        console.warn(`CREDIT BALANCE LOW: Current balance is ${creditResult.current_balance.toFixed(2)}`);
      }
    } catch (creditError) {
      console.error(`Error deducting credits for evaluation ${evaluationId}:`, creditError);
      // Continue even if credit deduction fails
    }
    
    return evaluation;
  } catch (error) {
    console.error(`Error calculating cost for evaluation ${evaluationId}:`, error);
    throw error;
  }
};

/**
 * Retroactively calculate costs for all evaluations without cost data
 * @returns {Promise<Object>} Summary of processed evaluations
 */
const calculateAllMissingCosts = async () => {
  try {
    console.log('Calculating costs for all evaluations without cost data');
    
    // Find all evaluations without cost model
    const evaluations = await InteractionAIQA.find({ costModel: { $exists: false } });
    console.log(`Found ${evaluations.length} evaluations without cost data`);
    
    let processed = 0;
    let errors = 0;
    
    // Process each evaluation
    for (const eval of evaluations) {
      try {
        await calculateEvaluationCost(eval._id);
        processed++;
      } catch (error) {
        console.error(`Error processing evaluation ${eval._id}:`, error);
        errors++;
      }
    }
    
    return {
      total: evaluations.length,
      processed,
      errors
    };
  } catch (error) {
    console.error('Error calculating costs for evaluations:', error);
    throw error;
  }
};

module.exports = {
  calculateEvaluationCost,
  calculateAllMissingCosts
};