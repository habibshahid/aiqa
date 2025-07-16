// services/unifiedProcessor.js - Updated to handle both messages and emails

const messageService = require('./messageService');
const emailService = require('./emailService');
const { processEmailInteraction } = require('./emailProcessor');

// Enhanced TEXT_CHANNELS with email support
const TEXT_CHANNELS = ['whatsapp', 'fb_messenger', 'facebook', 'instagram_dm', 'chat', 'email', 'sms'];
const EMAIL_CHANNELS = ['email'];

/**
 * Main entry point for processing text-based interactions
 * Automatically detects whether to use message or email processing
 * @param {Object} evaluation - Evaluation data containing interactionId, qaFormId, evaluator
 * @returns {Object} Processing result
 */
async function processTextInteraction(evaluation) {
  const { interactionId, qaFormId, evaluator } = evaluation;
  
  console.log(`\n=== Unified Processor: Processing interaction ${interactionId} ===`);
  
  try {
    // Step 1: Determine interaction type by checking the channel
    const interaction = await require('../config/mongodb').Interactions.findById(interactionId).lean();
    
    if (!interaction) {
      throw new Error(`Interaction not found: ${interactionId}`);
    }
    
    const channel = interaction.channel;
    console.log(`Detected channel: ${channel}`);
    
    // Step 2: Route to appropriate processor
    if (EMAIL_CHANNELS.includes(channel)) {
      console.log('Routing to email processor...');
      return await processEmailInteraction(evaluation);
    } else if (TEXT_CHANNELS.includes(channel)) {
      console.log('Routing to message processor...');
      return await processMessageInteraction(evaluation);
    } else {
      throw new Error(`Unsupported channel for text processing: ${channel}`);
    }
    
  } catch (error) {
    console.error(`❌ Unified processor failed for ${interactionId}:`, error);
    throw error;
  }
}

/**
 * Process message-based interaction (existing functionality)
 * @param {Object} evaluation - Evaluation data
 * @returns {Object} Processing result
 */
async function processMessageInteraction(evaluation) {
  // Import the existing message processor functionality
  const { processTextInteraction: processMessages } = require('./messageProcessor');
  return await processMessages(evaluation);
}

/**
 * Get interaction data for UI display - unified for both messages and emails
 * @param {string} interactionId - Interaction ID
 * @returns {Object} Interaction data with messages/emails
 */
async function getInteractionData(interactionId) {
  try {
    console.log(`Getting unified interaction data for: ${interactionId}`);
    
    // Get interaction details
    const interaction = await require('../config/mongodb').Interactions.findById(interactionId).lean();
    
    if (!interaction) {
      throw new Error(`Interaction not found: ${interactionId}`);
    }
    
    const channel = interaction.channel;
    let data = {
      interaction,
      channel,
      type: EMAIL_CHANNELS.includes(channel) ? 'email' : 'message'
    };
    
    // Get messages or emails based on channel
    if (EMAIL_CHANNELS.includes(channel)) {
      console.log('Fetching emails...');
      const emails = await emailService.getEmailsByInteractionId(interactionId);
      data.emails = emails;
      data.count = emails.length;
      data.stats = emailService.getConversationStats(emails);
    } else if (TEXT_CHANNELS.includes(channel)) {
      console.log('Fetching messages...');
      const messages = await messageService.getMessagesByInteractionId(interactionId);
      data.messages = messages;
      data.count = messages.length;
      data.stats = messageService.getConversationStats(messages);
    } else {
      throw new Error(`Unsupported channel: ${channel}`);
    }
    
    return data;
    
  } catch (error) {
    console.error('Error getting unified interaction data:', error);
    throw error;
  }
}

/**
 * Get interaction counts for multiple interactions - unified approach
 * @param {Array} interactionIds - Array of interaction IDs
 * @returns {Object} Map of interactionId -> count
 */
async function getInteractionCounts(interactionIds) {
  try {
    console.log(`Getting interaction counts for ${interactionIds.length} interactions`);
    
    // Get all interactions to determine their channels
    const objectIds = interactionIds.map(id => new require('mongoose').Types.ObjectId(id));
    const interactions = await require('../config/mongodb').Interactions.find({
      _id: { $in: objectIds }
    }).select('_id channel').lean();
    
    // Group by channel type
    const emailInteractionIds = [];
    const messageInteractionIds = [];
    
    interactions.forEach(interaction => {
      const idString = interaction._id.toString();
      if (EMAIL_CHANNELS.includes(interaction.channel)) {
        emailInteractionIds.push(idString);
      } else if (TEXT_CHANNELS.includes(interaction.channel)) {
        messageInteractionIds.push(idString);
      }
    });
    
    // Get counts from both services
    const emailCounts = emailInteractionIds.length > 0 ? 
      await emailService.getEmailCountsForInteractions(emailInteractionIds) : {};
    
    const messageCounts = messageInteractionIds.length > 0 ? 
      await messageService.getMessageCountsForInteractions(messageInteractionIds) : {};
    
    // Combine results
    return { ...emailCounts, ...messageCounts };
    
  } catch (error) {
    console.error('Error getting interaction counts:', error);
    throw error;
  }
}

/**
 * Check if an interaction can be evaluated
 * @param {Object} interaction - Interaction object
 * @returns {Object} Evaluation status
 */
async function checkEvaluationEligibility(interaction) {
  try {
    const channel = interaction.channel;
    
    if (EMAIL_CHANNELS.includes(channel)) {
      // Check if emails exist
      const emailCount = await emailService.getEmailCountsForInteractions([interaction._id.toString()]);
      const count = emailCount[interaction._id.toString()] || 0;
      
      return {
        canEvaluate: count > 0,
        reason: count > 0 ? 'Ready for evaluation' : 'No emails found',
        count: count,
        type: 'email'
      };
    } else if (TEXT_CHANNELS.includes(channel)) {
      // Check if messages exist
      const messageCount = await messageService.getMessageCountsForInteractions([interaction._id.toString()]);
      const count = messageCount[interaction._id.toString()] || 0;
      
      return {
        canEvaluate: count > 0,
        reason: count > 0 ? 'Ready for evaluation' : 'No messages found',
        count: count,
        type: 'message'
      };
    } else {
      return {
        canEvaluate: false,
        reason: 'Unsupported channel for text evaluation',
        count: 0,
        type: 'unknown'
      };
    }
    
  } catch (error) {
    console.error('Error checking evaluation eligibility:', error);
    return {
      canEvaluate: false,
      reason: 'Error checking eligibility',
      count: 0,
      type: 'error'
    };
  }
}

/**
 * Get statistics for both messages and emails
 * @param {Object} filters - Filter options
 * @returns {Object} Combined statistics
 */
async function getCombinedStatistics(filters = {}) {
  try {
    console.log('Getting combined statistics...');
    
    // Get statistics from both services
    const emailStats = await emailService.getEmailStatistics(filters);
    const messageStats = await messageService.getMessageStatistics ? 
      await messageService.getMessageStatistics(filters) : {};
    
    return {
      emails: emailStats,
      messages: messageStats,
      combined: {
        totalInteractions: (emailStats.uniqueInteractions || 0) + (messageStats.uniqueInteractions || 0),
        totalCommunications: (emailStats.totalEmails || 0) + (messageStats.totalMessages || 0),
        inboundCommunications: (emailStats.inboundEmails || 0) + (messageStats.inboundMessages || 0),
        outboundCommunications: (emailStats.outboundEmails || 0) + (messageStats.outboundMessages || 0)
      }
    };
    
  } catch (error) {
    console.error('Error getting combined statistics:', error);
    throw error;
  }
}

module.exports = {
  processTextInteraction,
  processMessageInteraction,
  getInteractionData,
  getInteractionCounts,
  checkEvaluationEligibility,
  getCombinedStatistics,
  TEXT_CHANNELS,
  EMAIL_CHANNELS
};