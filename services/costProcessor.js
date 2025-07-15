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
    const costAiContextGenerator = parseFloat(process.env.COST_AI_CONTEXT_GENERATOR || 0.00025);
    const priceAiContextGenerator = parseFloat(process.env.PRICE_AI_CONTEXT_GENERATOR || 0.0003125);

    // Get usage data from evaluation
    const usage = evaluation.evaluationData?.usage || {};
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    
    // Get call duration from interaction data
    const callDuration = evaluation.interactionData?.duration || 0; // in seconds
    
    // Determine if this is a text-based evaluation (no STT needed)
    const channel = evaluation.interactionData?.channel;
    const textChannels = ['whatsapp', 'fb_messenger', 'facebook', 'instagram_dm'];
    const isTextEvaluation = textChannels.includes(channel);
    
    console.log(`Evaluation channel: ${channel}, isTextEvaluation: ${isTextEvaluation}`);
    
    // Calculate STT costs (only for voice/audio evaluations)
    let sttCost = 0;
    let sttPrice = 0;
    let sttDuration = 0;
    
    if (!isTextEvaluation) {
      // Voice evaluation - include STT costs
      sttDuration = callDuration;
      sttCost = (callDuration / 60) * costSttPrerecorded; // Convert to minutes
      sttPrice = (callDuration / 60) * priceSttPrerecorded; // Convert to minutes
      console.log(`Voice evaluation - STT cost: $${sttCost.toFixed(6)} for ${callDuration} seconds`);
    } else {
      // Text evaluation - no STT costs
      console.log(`Text evaluation - no STT costs`);
    }
    
    // Calculate OpenAI costs (for both voice and text)
    const promptCost = promptTokens * costOpenAiInput;
    const completionCost = completionTokens * costOpenAiOutput;
    const totalCost = sttCost + promptCost + completionCost;
    
    // Calculate prices (what we charge)
    const promptPrice = promptTokens * priceOpenAiInput;
    const completionPrice = completionTokens * priceOpenAiOutput;
    const totalPrice = sttPrice + promptPrice + completionPrice;
    
    // Create cost model
    const costModel = {
      sttDuration,
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
      
      // Add metadata about evaluation type
      evaluationType: isTextEvaluation ? 'text' : 'voice',
      channel,
      
      createdAt: new Date()
    };
    
    // Save to evaluation
    evaluation.costModel = costModel;
    await evaluation.save();
    
    console.log(`Cost calculation completed for evaluation ${evaluationId}`);
    console.log(`  Type: ${isTextEvaluation ? 'text' : 'voice'}`);
    console.log(`  STT cost: $${sttCost.toFixed(6)} (${sttDuration} seconds)`);
    console.log(`  OpenAI cost: $${(promptCost + completionCost).toFixed(6)} (${promptTokens + completionTokens} tokens)`);
    console.log(`  Total cost: $${totalCost.toFixed(6)}, price: $${totalPrice.toFixed(6)}`);
    
    // Deduct credits based on price
    try {
      const description = `Evaluation: ${evaluationId} - ${isTextEvaluation ? 'Text' : 'Voice'} (${isTextEvaluation ? '0' : callDuration} seconds, ${promptTokens + completionTokens} tokens)`;
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