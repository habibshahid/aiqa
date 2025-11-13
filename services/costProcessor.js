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
    
    // Get transcription provider from env (default to assemblyai)
    const transcriptionProvider = process.env.TRANSCRIPTION_PROVIDER || 'assemblyai';
    
    // Get environment variables for costs - AssemblyAI
    const costSttAssemblyAIUniversal = parseFloat(process.env.COST_STT_ASSEMBLYAI_UNIVERSAL || 0.0025);
    const priceSttAssemblyAIUniversal = parseFloat(process.env.PRICE_STT_ASSEMBLYAI_UNIVERSAL || 0.003125);
    const costSttAssemblyAINano = parseFloat(process.env.COST_STT_ASSEMBLYAI_NANO || 0.0015);
    const priceSttAssemblyAINano = parseFloat(process.env.PRICE_STT_ASSEMBLYAI_NANO || 0.001875);
    
    // OpenAI Whisper costs
    const costSttOpenAIWhisper = parseFloat(process.env.COST_STT_OPENAI_WHISPER || 0.006);
    const priceSttOpenAIWhisper = parseFloat(process.env.PRICE_STT_OPENAI_WHISPER || 0.0075);
    const costSttOpenAIGPT4O = parseFloat(process.env.COST_STT_OPENAI_GPT4O || 0.006);
    const priceSttOpenAIGPT4O = parseFloat(process.env.PRICE_STT_OPENAI_GPT4O || 0.0075);
    const costSttOpenAIGPT4OMini = parseFloat(process.env.COST_STT_OPENAI_GPT4O_MINI || 0.003);
    const priceSttOpenAIGPT4OMini = parseFloat(process.env.PRICE_STT_OPENAI_GPT4O_MINI || 0.00375);
    
    // OpenAI GPT-4o costs (for evaluation)
    const costOpenAiInput = parseFloat(process.env.COST_OPENAI_GPT4O_INPUT || 0.00005);
    const costOpenAiOutput = parseFloat(process.env.COST_OPENAI_GPT4O_OUTPUT || 0.00015);
    const priceOpenAiInput = parseFloat(process.env.PRICE_OPENAI_GPT4O_INPUT || 0.0000625);
    const priceOpenAiOutput = parseFloat(process.env.PRICE_OPENAI_GPT4O_OUTPUT || 0.0001875);
    const costAiContextGenerator = parseFloat(process.env.COST_AI_CONTEXT_GENERATOR || 0.00025);
    const priceAiContextGenerator = parseFloat(process.env.PRICE_AI_CONTEXT_GENERATOR || 0.0003125);

	// Soniox costs
	const costSttSoniox = parseFloat(process.env.COST_STT_SONIOX || 0.00167); // $0.10/hour = $0.00167/min
    const priceSttSoniox = parseFloat(process.env.PRICE_STT_SONIOX || 0.00208); // 25% markup
    
    const costSttPrerecorded = parseFloat(process.env.COST_STT_PRERECORDED || 0.0052);
    const priceSttPrerecorded = parseFloat(process.env.PRICE_STT_PRERECORDED || 0.0065);


    // Get usage data from evaluation
    const usage = evaluation.evaluationData?.usage || {};
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    
    // Get call duration from interaction data
    const callDuration = evaluation.interactionData?.duration || 0; // in seconds
    
    // Determine if this is a text-based evaluation (no STT needed)
    const channel = evaluation.interactionData?.channel;
    const textChannels = ['whatsapp', 'fb_messenger', 'facebook', 'instagram_dm', 'email'];
    const isTextEvaluation = textChannels.includes(channel);
    
    console.log(`Evaluation channel: ${channel}, isTextEvaluation: ${isTextEvaluation}`);
    
    // Calculate STT costs (only for voice/audio evaluations)
    let sttCost = 0;
    let sttPrice = 0;
    let sttDuration = 0;
    let sttProvider = 'none';
    let sttModel = 'none';
    
    if (!isTextEvaluation) {
      // Voice evaluation - include STT costs
      sttDuration = callDuration;
      
      // Get provider and model from evaluation metadata (if available)
      const provider = evaluation.transcriptionMetadata?.provider || transcriptionProvider;
      const model = evaluation.transcriptionMetadata?.model || 'universal';
      
      sttProvider = provider;
      sttModel = model;
      
      // Calculate cost based on provider and model
      if (provider === 'assemblyai') {
        if (model === 'nano') {
          sttCost = (sttDuration / 60) * costSttAssemblyAINano;
          sttPrice = (sttDuration / 60) * priceSttAssemblyAINano;
          console.log(`AssemblyAI Nano - STT cost: $${sttCost.toFixed(6)} for ${sttDuration} seconds`);
        } else {
          // Default to universal
          sttCost = (sttDuration / 60) * costSttAssemblyAIUniversal;
          sttPrice = (sttDuration / 60) * priceSttAssemblyAIUniversal;
          console.log(`AssemblyAI Universal - STT cost: $${sttCost.toFixed(6)} for ${sttDuration} seconds`);
        }
      } else if (provider === 'openai') {
        if (model === 'gpt-4o-mini-transcribe') {
          sttCost = (sttDuration / 60) * costSttOpenAIGPT4OMini;
          sttPrice = (sttDuration / 60) * priceSttOpenAIGPT4OMini;
          console.log(`OpenAI GPT-4o Mini - STT cost: $${sttCost.toFixed(6)} for ${sttDuration} seconds`);
        } else if (model === 'gpt-4o-transcribe') {
          sttCost = (sttDuration / 60) * costSttOpenAIGPT4O;
          sttPrice = (sttDuration / 60) * priceSttOpenAIGPT4O;
          console.log(`OpenAI GPT-4o - STT cost: $${sttCost.toFixed(6)} for ${sttDuration} seconds`);
        } else {
          // Default to whisper-1
          sttCost = (sttDuration / 60) * costSttOpenAIWhisper;
          sttPrice = (sttDuration / 60) * priceSttOpenAIWhisper;
          console.log(`OpenAI Whisper - STT cost: $${sttCost.toFixed(6)} for ${sttDuration} seconds`);
        }
      } else if (provider === 'soniox') {
        sttCost = (sttDuration / 60) * costSttSoniox;
        sttPrice = (sttDuration / 60) * priceSttSoniox;
        console.log(`Soniox - STT cost: $${sttCost.toFixed(6)} for ${sttDuration} seconds`);
      } else {
        // Deepgram fallback
        sttCost = (sttDuration / 60) * costSttPrerecorded;
        sttPrice = (sttDuration / 60) * priceSttPrerecorded;
        console.log(`Deepgram - STT cost: $${sttCost.toFixed(6)} for ${sttDuration} seconds`);
      }
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
      sttProvider,
      sttModel,
      
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
    console.log(`  STT Provider: ${sttProvider}, Model: ${sttModel}`);
    console.log(`  STT cost: $${sttCost.toFixed(6)} (${sttDuration} seconds)`);
    console.log(`  OpenAI cost: $${(promptCost + completionCost).toFixed(6)} (${promptTokens + completionTokens} tokens)`);
    console.log(`  Total cost: $${totalCost.toFixed(6)}, price: $${totalPrice.toFixed(6)}`);
    
    // Deduct credits based on price
    try {
      const description = `Evaluation: ${evaluationId} - ${isTextEvaluation ? 'Text' : 'Voice'} (${isTextEvaluation ? '0' : callDuration} seconds, ${promptTokens + completionTokens} tokens) - ${sttProvider}`;
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