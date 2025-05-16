// services/billingService.js
const { InteractionAIQA } = require('../config/mongodb');

// Load cost and price constants from environment variables with fallbacks
const CONFIG = {
  cost: {
    stt: {
      preRecorded: parseFloat(process.env.COST_STT_PRERECORDED) || 0.0052, // per minute
    },
    openai: {
      gpt4o: {
        inputToken: parseFloat(process.env.COST_OPENAI_GPT4O_INPUT) || 0.00005,
        outputToken: parseFloat(process.env.COST_OPENAI_GPT4O_OUTPUT) || 0.00015,
      },
    },
    aiContextGenerator: parseFloat(process.env.COST_AI_CONTEXT_GENERATOR) || 0.00025
  },
  price: {
    stt: {
      preRecorded: parseFloat(process.env.PRICE_STT_PRERECORDED) || 0.0065, // per minute
    },
    openai: {
      gpt4o: {
        inputToken: parseFloat(process.env.PRICE_OPENAI_GPT4O_INPUT) || 0.0000625,
        outputToken: parseFloat(process.env.PRICE_OPENAI_GPT4O_OUTPUT) || 0.0001875,
      }
    },
    aiContextGenerator: parseFloat(process.env.PRICE_AI_CONTEXT_GENERATOR) || 0.0003125
  }
};

/**
 * Calculate cost and price for a single evaluation
 * @param {Object} evaluation - The evaluation document
 * @returns {Object} Cost and price breakdown
 */
const calculateEvaluationFinancials = (evaluation) => {
  // Check if financial info is already stored in the evaluation
  if (evaluation.billingInfo?.totalCost !== undefined && 
      evaluation.billingInfo?.totalPrice !== undefined) {
    // Return the stored billing info
    return evaluation.billingInfo;
  }
  
  // Extract usage data
  const usage = evaluation.evaluationData?.usage || {};
  const interaction = evaluation.interactionData || {};
  
  // Calculate audio duration in minutes
  let audioDurationMinutes = 0;
  let audioDurationSeconds = 0;
  
  if (interaction.duration) {
    audioDurationSeconds = interaction.duration;
  } else if (interaction.connect?.duration) {
    audioDurationSeconds = interaction.connect.duration;
  }
  
  audioDurationMinutes = audioDurationSeconds / 60;
  
  // Get token counts
  const inputTokens = usage.prompt_tokens || 0;
  const outputTokens = usage.completion_tokens || 0;
  const totalTokens = usage.total_tokens || 0;
  
  // Calculate STT cost and price
  const sttCost = audioDurationMinutes * CONFIG.cost.stt.preRecorded;
  const sttPrice = audioDurationMinutes * CONFIG.price.stt.preRecorded;
  
  // Calculate OpenAI cost and price
  const openaiCost = (inputTokens * CONFIG.cost.openai.gpt4o.inputToken) + 
                    (outputTokens * CONFIG.cost.openai.gpt4o.outputToken);
  const openaiPrice = (inputTokens * CONFIG.price.openai.gpt4o.inputToken) + 
                      (outputTokens * CONFIG.price.openai.gpt4o.outputToken);
  
  // Calculate total cost and price
  const totalCost = sttCost + openaiCost;
  const totalPrice = sttPrice + openaiPrice;
  
  // Calculate profit
  const profit = totalPrice - totalCost;
  const profitMargin = totalCost > 0 ? ((profit / totalCost) * 100) : 0;
  
  // Return formatted financial data
  return {
    evaluationId: evaluation._id,
    date: evaluation.createdAt,
    agent: evaluation.interactionData?.agent?.name || 'Unknown',
    interactionId: evaluation.interactionId,
    callDuration: {
      seconds: audioDurationSeconds,
      minutes: audioDurationMinutes
    },
    tokens: {
      input: inputTokens,
      output: outputTokens,
      total: totalTokens
    },
    cost: {
      stt: parseFloat(sttCost.toFixed(4)),
      openai: parseFloat(openaiCost.toFixed(4)),
      total: parseFloat(totalCost.toFixed(4))
    },
    price: {
      stt: parseFloat(sttPrice.toFixed(4)),
      openai: parseFloat(openaiPrice.toFixed(4)),
      total: parseFloat(totalPrice.toFixed(4))
    },
    profit: {
      amount: parseFloat(profit.toFixed(4)),
      margin: parseFloat(profitMargin.toFixed(2))
    },
    rates: {
      cost: {
        stt: CONFIG.cost.stt.preRecorded,
        openaiInput: CONFIG.cost.openai.gpt4o.inputToken,
        openaiOutput: CONFIG.cost.openai.gpt4o.outputToken
      },
      price: {
        stt: CONFIG.price.stt.preRecorded,
        openaiInput: CONFIG.price.openai.gpt4o.inputToken,
        openaiOutput: CONFIG.price.openai.gpt4o.outputToken
      }
    }
  };
};

/**
 * Store billing information in an evaluation document
 * @param {string} evaluationId - The evaluation ID
 * @param {Object} billingInfo - The billing information to store
 * @returns {Promise<boolean>} Success status
 */
const storeBillingInfo = async (evaluationId, billingInfo) => {
  try {
    await InteractionAIQA.findByIdAndUpdate(
      evaluationId,
      { $set: { billingInfo } }
    );
    return true;
  } catch (error) {
    console.error('Error storing billing info:', error);
    return false;
  }
};

/**
 * Calculate and store billing information for an evaluation
 * @param {string} evaluationId - The evaluation ID
 * @returns {Promise<Object>} The billing information
 */
const calculateAndStoreBillingInfo = async (evaluationId) => {
  try {
    const evaluation = await InteractionAIQA.findById(evaluationId);
    if (!evaluation) {
      throw new Error('Evaluation not found');
    }
    
    const billingInfo = calculateEvaluationFinancials(evaluation);
    await storeBillingInfo(evaluationId, billingInfo);
    
    return billingInfo;
  } catch (error) {
    console.error('Error calculating and storing billing info:', error);
    throw error;
  }
};

/**
 * Get billing summary for a date range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Object} Billing summary
 */
const getBillingSummary = async (startDate, endDate) => {
  // Default to current month if no dates provided
  const start = startDate || new Date(new Date().setDate(1));
  const end = endDate || new Date();
  
  // Ensure end date includes the entire day
  end.setHours(23, 59, 59, 999);
  
  // Fetch all evaluations in the date range
  const evaluations = await InteractionAIQA.find({
    createdAt: { $gte: start, $lte: end }
  }).lean();
  
  // Process evaluations to calculate usage and costs
  const billingData = {
    totalEvaluations: evaluations.length,
    stt: {
      totalMinutes: 0,
      cost: 0,
      price: 0
    },
    openai: {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      cost: 0,
      price: 0
    },
    total: {
      cost: 0,
      price: 0,
      profit: 0,
      profitMargin: 0
    },
    evaluations: []
  };
  
  // Process each evaluation
  for (const evaluation of evaluations) {
    const evaluationFinancials = calculateEvaluationFinancials(evaluation);
    
    // Add to totals
    billingData.stt.totalMinutes += evaluationFinancials.callDuration.minutes;
    billingData.stt.cost += evaluationFinancials.cost.stt;
    billingData.stt.price += evaluationFinancials.price.stt;
    
    billingData.openai.totalInputTokens += evaluationFinancials.tokens.input;
    billingData.openai.totalOutputTokens += evaluationFinancials.tokens.output;
    billingData.openai.totalTokens += evaluationFinancials.tokens.total;
    billingData.openai.cost += evaluationFinancials.cost.openai;
    billingData.openai.price += evaluationFinancials.price.openai;
    
    billingData.total.cost += evaluationFinancials.cost.total;
    billingData.total.price += evaluationFinancials.price.total;
    billingData.total.profit += evaluationFinancials.profit.amount;
    
    // Add evaluation details
    billingData.evaluations.push({
      id: evaluation._id,
      date: evaluation.createdAt,
      agent: evaluation.interactionData?.agent?.name || 'Unknown',
      interactionId: evaluation.interactionId,
      audioDurationMinutes: evaluationFinancials.callDuration.minutes,
      inputTokens: evaluationFinancials.tokens.input,
      outputTokens: evaluationFinancials.tokens.output,
      totalTokens: evaluationFinancials.tokens.total,
      cost: {
        stt: evaluationFinancials.cost.stt,
        openai: evaluationFinancials.cost.openai,
        total: evaluationFinancials.cost.total
      },
      price: {
        stt: evaluationFinancials.price.stt,
        openai: evaluationFinancials.price.openai,
        total: evaluationFinancials.price.total
      },
      profit: evaluationFinancials.profit.amount
    });
  }
  
  // Sort evaluations by date (newest first)
  billingData.evaluations.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // Calculate profit margin
  billingData.total.profitMargin = billingData.total.cost > 0 
    ? ((billingData.total.profit / billingData.total.cost) * 100)
    : 0;
  
  // Round currency values to 4 decimal places for display
  billingData.stt.cost = parseFloat(billingData.stt.cost.toFixed(4));
  billingData.stt.price = parseFloat(billingData.stt.price.toFixed(4));
  billingData.openai.cost = parseFloat(billingData.openai.cost.toFixed(4));
  billingData.openai.price = parseFloat(billingData.openai.price.toFixed(4));
  billingData.total.cost = parseFloat(billingData.total.cost.toFixed(4));
  billingData.total.price = parseFloat(billingData.total.price.toFixed(4));
  billingData.total.profit = parseFloat(billingData.total.profit.toFixed(4));
  billingData.total.profitMargin = parseFloat(billingData.total.profitMargin.toFixed(2));
  
  return billingData;
};

/**
 * Get monthly billing data for a specific year
 * @param {Number} year - Year to get data for
 * @returns {Array} Monthly billing data
 */
const getMonthlyBillingData = async (year) => {
  // Default to current year
  const targetYear = year || new Date().getFullYear();
  
  // Create aggregation pipeline
  const monthlyData = await InteractionAIQA.aggregate([
    {
      $match: {
        createdAt: {
          $gte: new Date(`${targetYear}-01-01T00:00:00.000Z`),
          $lte: new Date(`${targetYear}-12-31T23:59:59.999Z`)
        }
      }
    },
    {
      $addFields: {
        month: { $month: "$createdAt" }
      }
    },
    {
      $group: {
        _id: "$month",
        count: { $sum: 1 },
        totalInputTokens: { 
          $sum: { 
            $ifNull: ["$evaluationData.usage.prompt_tokens", 0] 
          } 
        },
        totalOutputTokens: { 
          $sum: { 
            $ifNull: ["$evaluationData.usage.completion_tokens", 0] 
          } 
        },
        totalTokens: { 
          $sum: { 
            $ifNull: ["$evaluationData.usage.total_tokens", 0] 
          }
        },
        // For duration, try to get from interaction.duration or connect.duration
        totalDuration: {
          $sum: {
            $cond: [
              { $ifNull: ["$interactionData.duration", false] },
              "$interactionData.duration",
              { $ifNull: ["$interactionData.connect.duration", 0] }
            ]
          }
        }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);
  
  // Format the results with month names, costs etc
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const formattedData = Array.from({ length: 12 }, (_, i) => {
    // Find the data for this month
    const monthData = monthlyData.find(m => m._id === i + 1) || {
      _id: i + 1,
      count: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      totalDuration: 0
    };
    
    // Calculate minutes
    const durationMinutes = monthData.totalDuration / 60;
    
    // Calculate costs and prices
    const sttCost = durationMinutes * CONFIG.cost.stt.preRecorded;
    const sttPrice = durationMinutes * CONFIG.price.stt.preRecorded;
    
    const openaiCost = (monthData.totalInputTokens * CONFIG.cost.openai.gpt4o.inputToken) +
                        (monthData.totalOutputTokens * CONFIG.cost.openai.gpt4o.outputToken);
    const openaiPrice = (monthData.totalInputTokens * CONFIG.price.openai.gpt4o.inputToken) +
                        (monthData.totalOutputTokens * CONFIG.price.openai.gpt4o.outputToken);
    
    const totalCost = sttCost + openaiCost;
    const totalPrice = sttPrice + openaiPrice;
    const profit = totalPrice - totalCost;
    const profitMargin = totalCost > 0 ? ((profit / totalCost) * 100) : 0;
    
    return {
      month: months[i],
      monthNum: i + 1,
      year: targetYear,
      evaluationCount: monthData.count,
      stt: {
        minutes: parseFloat(durationMinutes.toFixed(2)),
        cost: parseFloat(sttCost.toFixed(4)),
        price: parseFloat(sttPrice.toFixed(4))
      },
      openai: {
        inputTokens: monthData.totalInputTokens,
        outputTokens: monthData.totalOutputTokens,
        totalTokens: monthData.totalTokens,
        cost: parseFloat(openaiCost.toFixed(4)),
        price: parseFloat(openaiPrice.toFixed(4))
      },
      totalCost: parseFloat(totalCost.toFixed(4)),
      totalPrice: parseFloat(totalPrice.toFixed(4)),
      profit: parseFloat(profit.toFixed(4)),
      profitMargin: parseFloat(profitMargin.toFixed(2))
    };
  });
  
  return formattedData;
};

module.exports = {
  calculateEvaluationFinancials,
  calculateAndStoreBillingInfo,
  storeBillingInfo,
  getBillingSummary,
  getMonthlyBillingData,
  CONFIG
};