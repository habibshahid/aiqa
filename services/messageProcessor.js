// services/messageProcessor.js
const axios = require('axios');
const { InteractionTranscription, QAForm, Interactions, InteractionAIQA } = require('../config/mongodb');
const messageService = require('./messageService');
const { calculateEvaluationCost } = require('./costProcessor');
const { processEvaluationResponse, updateEvaluationForClassification } = require('./qaProcessor');
const mongoose = require('mongoose');
const emailService = require('./emailService');

// Text-based channels that should use message processing
const TEXT_CHANNELS = ['whatsapp', 'fb_messenger', 'facebook', 'instagram_dm', 'chat', 'email', 'sms'];

/**
 * Format QA form parameters into instructions for AI evaluation
 * @param {Object} form - QA form data
 * @returns {string} Formatted instructions for AI evaluation
 */
function formatInstructions(form) {
  let instructions = `You are a quality analyst evaluating a ${form.interactionType || 'call center'} interaction.`;

  instructions += 'Based on the following evaluation criteria, please assess the interaction and provide scores:\n\n';

  // Add each parameter with its context
  form.parameters.forEach((param, index) => {
    instructions += `${index + 1}. ${param.label}:\n`;
    instructions += `   Context: ${param.evaluationContext}\n`;
    instructions += `   Max Score: ${param.maxScore}\n`;
    instructions += `   Scoring Type: ${param.scoringType}\n`;
    
    if (param.classification) {
      instructions += `   Classification: ${param.classification}\n`;
    }
    
    instructions += '\n';
  });

  // Add specific instructions for text-based interactions
  if (form.interactionType === 'text_conversation') {
    instructions += '\nNote: This is a text-based conversation. Please consider:\n';
    instructions += '- Response time and efficiency\n';
    instructions += '- Clarity and helpfulness of written communication\n';
    instructions += '- Professional tone and language\n';
    instructions += '- Resolution of customer queries through text\n\n';
  }

  instructions += 'areasOfImprovements: find the things the agent could have done better. It should be in an array\n';
  instructions += 'whatTheAgentDidWell: find the areas where the agent did well in the interaction. It should be in an array\n';
  instructions += 'Please provide your evaluation with a score for each question, along with an explanation of your reasoning. Also include an overall assessment of the interaction.\n';
  
  // Additional instructions for handling question classifications
  instructions += '\nassign a classification tag to the question response. The classification tags are none, minor, moderate, major. If the instructions have none then do not apply any classification';
  instructions += '\nwhen returning the response do not include the text Question in parameter name, just the label name';
  
  if (process.env.AIQA_SAMPLE_RESPONSE) {
    instructions += process.env.AIQA_SAMPLE_RESPONSE;
  }
  
  console.log('Formatted Instructions:', instructions);
  return instructions;
}

/**
 * Process text-based interaction (WhatsApp, Facebook, Instagram, etc.)
 * @param {Object} evaluation - Evaluation data containing interactionId, qaFormId, evaluator
 * @returns {Object} Processing result
 */
async function processTextInteraction(evaluation) {
  const { interactionId, qaFormId, evaluator } = evaluation;
  
  console.log(`\n=== Message Processor: Starting text interaction processing for ${interactionId} ===`);
  
console.log('$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$', evaluation);

  try {
    const interaction = await Interactions.findById(interactionId).lean();
    if (!interaction) {
      throw new Error(`Interaction not found: ${interactionId}`);
    }
    
    const channel = interaction.channel || 'text';
    const isEmail = channel === 'email';
    
    console.log(`Processing ${channel} interaction`);
    
    // Step 2: Get messages/emails based on channel
    console.log(`Step 1: Fetching ${isEmail ? 'emails' : 'messages'} from ${isEmail ? 'email' : 'message'} service...`);
    
    let messages;
    if (isEmail) {
      messages = await emailService.getEmailsByInteractionId(interactionId);
    } else {
      messages = await messageService.getMessagesByInteractionId(interactionId);
    }
    
    if (!messages || messages.length === 0) {
      throw new Error(`No ${isEmail ? 'emails' : 'messages'} found for interaction ${interactionId}`);
    }
    
    console.log(`Found ${messages.length} ${isEmail ? 'emails' : 'messages'} for interaction ${interactionId}`);

    // Step 3: Format messages into conversation using appropriate service
    console.log('Step 2: Formatting into conversation...');
    const conversation = isEmail ? 
      emailService.formatEmailsAsConversation(messages) : 
      messageService.formatMessagesAsConversation(messages);
    
    // Step 4: Generate conversation stats using appropriate service
    console.log('Step 3: Generating conversation statistics...');
    const conversationStats = isEmail ? 
      emailService.getConversationStats(messages) : 
      messageService.getConversationStats(messages);
    
    // Step 5: Create conversation text for AI analysis
    // Note: conversation structure is the same for both services
    console.log('Step 4: Creating conversation text for AI analysis...');
    const conversationText = await createConversationText(conversation, messages, channel);
    
    // Step 6: Perform sentiment analysis (optional, can be skipped if service is down)
    console.log('Step 5: Performing sentiment analysis...');
    let sentimentAnalysis;
    try {
      sentimentAnalysis = await performSentimentAnalysis(conversationText);
    } catch (sentimentError) {
      console.warn('Sentiment analysis failed, using defaults:', sentimentError.message);
      sentimentAnalysis = getDefaultSentimentAnalysis(conversationText);
    }

    // Step 7: Save conversation as transcription
    console.log('Step 6: Saving conversation transcription...');
    await saveConversationTranscription(interactionId, conversation, sentimentAnalysis);

    // Step 8: Get QA form and format instructions
    console.log('Step 7: Getting QA form and formatting instructions...');
    const qaForm = await QAForm.findById(qaFormId);
    if (!qaForm) {
      throw new Error(`QA Form not found: ${qaFormId}`);
    }

    const formattedQAForm = {
      formId: qaForm._id,
      formName: qaForm.name,
      interactionType: `${channel}_conversation`, // email_conversation or text_conversation
      parameters: qaForm.parameters.map(param => ({
        label: param.name,
        evaluationContext: param.context,
        maxScore: param.maxScore,
        scoringType: param.scoringType,
        classification: param.classification
      })),
      classifications: qaForm.classifications 
    };

    const instructions = formatInstructions(formattedQAForm);

    console.log('Step 8: Sending to AI evaluation service...');
    const evaluationResult = await sendToAIEvaluation(conversationText, instructions, sentimentAnalysis);

    // Step 9: Get interaction metadata
    console.log('Step 9: Getting interaction metadata...');
    const interactionMetadata = await getInteractionMetadata(interactionId, messages, conversationStats, channel, interaction);

    // Step 10: Process evaluation response
    console.log('Step 10: Processing evaluation response...');
    const processedDocument = await processEvaluationResponse(
      evaluationResult,
      interactionId,
      qaForm._id,
      qaForm.name,
      interactionMetadata.agent, 
      interactionMetadata.caller, 
      interactionMetadata.channel, 
      interactionMetadata.direction,
      interactionMetadata.duration,
      evaluator,
      interactionMetadata.queue.name
    );

    // Step 11: Insert into collection
    console.log('Step 11: Saving evaluation to database...');
    const aiqaDoc = await InteractionAIQA.create(processedDocument);
    
    console.log(`Successfully processed ${channel} interaction ${interactionId}`);
    
    console.log('InteractionAIQA Document Created with ID:', aiqaDoc._id);
    console.log('Total Score:', aiqaDoc.evaluationData.evaluation.totalScore);
    console.log('Max Score:', aiqaDoc.evaluationData.evaluation.maxScore);
    
    // Step 12: Update evaluation for classification (SAME AS qaProcessor!)
    console.log('Step 12: Updating evaluation for classification...');
    updateEvaluationForClassification(evaluationResult, aiqaDoc, qaFormId);

    // Step 13: Calculate and save cost data (THE ORIGINAL FIX!)
    try {
      console.log('Step 13: Calculating cost data for text evaluation...');
      await calculateEvaluationCost(aiqaDoc._id);
      console.log('Cost data calculated and saved for evaluation:', aiqaDoc._id);
    } catch (costError) {
      console.error('Error calculating cost data:', costError);
      // Continue without cost data if calculation fails
    }

    console.log(`\n=== Message Processor: Successfully processed text interaction ${interactionId} ===`);
    
    const interactionObjectId = mongoose.Types.ObjectId.isValid(interactionId) 
            ? new mongoose.Types.ObjectId(interactionId) 
            : interactionId;
    
          // Mark the interaction as evaluated
          await Interactions.updateOne(
            { _id: interactionObjectId },
            { 
              $set: { 
                "extraPayload.evaluated": true,
                "extraPayload.evaluationId": aiqaDoc['_id'].toString() // Store the evaluation ID for linking
              } 
            }
          );
    

    return {
      success: true,
      interactionId,
      evaluationId: aiqaDoc._id,
      messageCount: messages.length,
      conversationStats,
      evaluation: aiqaDoc
    };
  } catch (error) {
    console.error(`\n=== Message Processor: Error processing interaction ${interactionId} ===`);
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    return {
      success: false,
      interactionId,
      error: error.message,
      stack: error.stack
    };
  }
}

/**
 * Format messages into transcription-like format
 * @param {Array} messages - Array of message objects
 * @returns {Object} Formatted conversation object
 */
async function formatMessagesForTranscription(messages) {
  console.log(`Formatting ${messages.length} messages into transcription format`);
  
  const transcription = [];
  const metadata = {
    totalMessages: messages.length,
    participants: [],
    channels: [],
    timespan: {
      start: null,
      end: null
    },
    hasMultimedia: false
  };
  
  // Sort messages by timestamp
  const sortedMessages = messages.sort((a, b) => 
    new Date(a.timestamp) - new Date(b.timestamp)
  );
  
  // Process each message
  sortedMessages.forEach((message, index) => {
    const timestamp = new Date(message.timestamp).getTime();
    
    // Build transcription entry
    const transcriptionEntry = {
      [timestamp]: {
        original_text: message.content || message.text || '',
        speaker_role: message.direction === 'inbound' ? 'customer' : 'agent',
        message_type: message.type || 'text',
        attachments: message.attachments || [],
        forwarded: message.forwarded || false,
        replied_to: message.replied_to || null
      }
    };
    
    transcription.push(transcriptionEntry);
    
    // Update metadata
    if (!metadata.timespan.start || timestamp < metadata.timespan.start) {
      metadata.timespan.start = timestamp;
    }
    if (!metadata.timespan.end || timestamp > metadata.timespan.end) {
      metadata.timespan.end = timestamp;
    }
    
    // Track participants
    const participant = message.direction === 'inbound' ? 'customer' : 'agent';
    if (!metadata.participants.includes(participant)) {
      metadata.participants.push(participant);
    }
    
    // Track channels
    if (message.channel && !metadata.channels.includes(message.channel)) {
      metadata.channels.push(message.channel);
    }
    
    // Check for multimedia
    if (message.attachments && message.attachments.length > 0) {
      metadata.hasMultimedia = true;
    }
  });
  
  console.log(`Created transcription with ${transcription.length} entries`);
  
  return {
    transcription,
    metadata
  };
}

/**
 * Generate conversation statistics
 * @param {Array} messages - Array of message objects
 * @returns {Object} Conversation statistics
 */
function generateConversationStats(messages) {
  const stats = {
    totalMessages: messages.length,
    inboundMessages: 0,
    outboundMessages: 0,
    multimediaMessages: 0,
    averageResponseTime: 0,
    conversationDuration: 0
  };
  
  let responseTimes = [];
  let lastInboundTime = null;
  let firstMessageTime = null;
  let lastMessageTime = null;
  
  messages.forEach(message => {
    const messageTime = new Date(message.timestamp);
    
    if (!firstMessageTime) firstMessageTime = messageTime;
    lastMessageTime = messageTime;
    
    if (message.direction === 'inbound') {
      stats.inboundMessages++;
      lastInboundTime = messageTime;
    } else {
      stats.outboundMessages++;
      // Calculate response time if we have a previous inbound message
      if (lastInboundTime) {
        const responseTime = messageTime - lastInboundTime;
        responseTimes.push(responseTime);
      }
    }
    
    if (message.attachments && message.attachments.length > 0) {
      stats.multimediaMessages++;
    }
  });
  
  // Calculate average response time
  if (responseTimes.length > 0) {
    const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    stats.averageResponseTime = Math.round(avgResponseTime / 1000); // Convert to seconds
  }
  
  // Calculate conversation duration
  if (firstMessageTime && lastMessageTime) {
    stats.conversationDuration = Math.round((lastMessageTime - firstMessageTime) / 1000); // Convert to seconds
  }
  
  return stats;
}

/**
 * Create formatted conversation text for AI analysis
 * Updated to support both messages and emails using the same transcription format
 * @param {Object} conversation - Formatted conversation object from messageService or emailService
 * @param {Array} messages - Original messages/emails array
 * @param {string} channel - Channel type (defaults to 'text' for backward compatibility)
 * @returns {string} Formatted conversation text
 */
async function createConversationText(conversation, messages, channel = 'text') {
  console.log(`Creating conversation text from ${messages.length} ${channel === 'email' ? 'emails' : 'messages'}`);
  
  let conversationText = '';
  
  // Add conversation header
  conversationText += `=== CONVERSATION TRANSCRIPT ===\n`;
  conversationText += `Channel: ${channel}\n`;
  conversationText += `Total ${channel === 'email' ? 'Emails' : 'Messages'}: ${messages.length}\n`;
  
  // Calculate duration if we have messages
  if (messages.length > 1) {
    const firstMessage = new Date(channel === 'email' ? (messages[0].receivedAt || messages[0].createdAt) : messages[0].createdAt);
    const lastMessage = new Date(channel === 'email' ? (messages[messages.length - 1].receivedAt || messages[messages.length - 1].createdAt) : messages[messages.length - 1].createdAt);
    const duration = Math.round((lastMessage - firstMessage) / 1000);
    conversationText += `Duration: ${duration} seconds\n`;
  }
  
  conversationText += `\n=== ${channel === 'email' ? 'EMAILS' : 'MESSAGES'} ===\n`;

  // Use the conversation.transcription format (same for both messages and emails)
  conversation.transcription.forEach((entry, index) => {
    const timestamp = Object.keys(entry)[0];
    const messageData = entry[timestamp];
    const messageTime = new Date(parseInt(timestamp));
    const timeString = messageTime.toLocaleTimeString();
    
    const speakerLabel = messageData.speaker_role === 'customer' ? 'Customer' : 'Agent';
    
    // For emails, include subject line
    if (channel === 'email' && messageData.subject) {
      conversationText += `\n[${timeString}] ${speakerLabel}: [Subject: ${messageData.subject}]\n`;
    } else {
      conversationText += `\n[${timeString}] ${speakerLabel}:\n`;
    }
    
    // Add message content
    conversationText += `${messageData.original_text || '[No content]'}\n`;
    
    // Add attachment info if present
    if (messageData.attachments && messageData.attachments.length > 0) {
      conversationText += `[Attachments: ${messageData.attachments.length}]\n`;
    }
  });
  
  conversationText += '\n=== END OF TRANSCRIPT ===\n';
  
  return conversationText;
}

/**
 * Perform sentiment analysis on conversation text
 * @param {string} conversationText - The conversation text to analyze
 * @returns {Object} Sentiment analysis results
 */
async function performSentimentAnalysis(conversationText) {
  try {
    console.log('Performing sentiment analysis on conversation...');
    
    const sentimentApiUrl = process.env.SENTIMENT_API_URL || 'http://democc.contegris.com:60027/callTranscription';
    
    const response = await axios.post(sentimentApiUrl, {
      text: conversationText,
      includeIntent: true,
      includeProfanity: true,
      includeTranslation: true
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });

    console.log('Sentiment analysis completed successfully');
    return response.data;
    
  } catch (error) {
    console.warn('Sentiment analysis failed, using defaults:', error.message);
    
    // Return default sentiment analysis if the service fails
    return {
      sentiment: {
        score: 0.5,
        sentiment: "neutral"
      },
      profanity: {
        score: 0,
        words: []
      },
      intents: [],
      language: "en",
      translationInEnglish: conversationText
    };
  }
}

/**
 * Get default sentiment analysis when service fails
 * @param {string} conversationText - The conversation text
 * @returns {Object} Default sentiment analysis
 */
function getDefaultSentimentAnalysis(conversationText) {
  return {
    sentiment: {
      score: 0.5,
      sentiment: "neutral"
    },
    profanity: {
      score: 0,
      words: []
    },
    intents: [],
    language: "en",
    translationInEnglish: conversationText,
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    }
  };
}

/**
 * Save conversation as transcription in database
 * @param {string} interactionId - Interaction ID
 * @param {Object} conversation - Formatted conversation from messageService
 * @param {Object} sentimentAnalysis - Sentiment analysis results
 */
async function saveConversationTranscription(interactionId, conversation, sentimentAnalysis) {
  try {
    console.log(`Saving conversation transcription for interaction ${interactionId}`);
    
    const transcriptionDoc = {
      interactionId,
      transcriptionVersion: 'messages',
      transcription: conversation, // Use the conversation object from messageService
      metadata: {
        source: 'messageService',
        totalMessages: conversation.length || 0
      },
      sentimentAnalysis
    };

    // Check if transcription already exists
    const existingTranscription = await InteractionTranscription.findOne({ interactionId });
    
    if (existingTranscription) {
      await InteractionTranscription.updateOne(
        { interactionId },
        { $set: transcriptionDoc }
      );
      console.log('Updated existing transcription');
    } else {
      await InteractionTranscription.create(transcriptionDoc);
      console.log('Created new transcription');
    }
    
  } catch (error) {
    console.error('Error saving conversation transcription:', error);
    throw error;
  }
}

/**
 * Send conversation to AI evaluation service
 * @param {string} conversationText - Formatted conversation text
 * @param {string} instructions - QA form instructions
 * @param {Object} sentimentAnalysis - Sentiment analysis results
 * @returns {Object} AI evaluation results
 */
async function sendToAIEvaluation(conversationText, instructions) {
  try {
    console.log('Sending conversation to AI evaluation service...');
    
    const evaluationUrl = process.env.QAEVALUATION_URL || 'http://democc.contegris.com:60027/aiqa';
    
    const response = await axios.post(evaluationUrl, {
      transcription: conversationText,
      instructions: instructions
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 60000 // 60 second timeout for AI evaluation
    });

    console.log('AI evaluation completed successfully');
    return response.data;
    
  } catch (error) {
    console.error('AI evaluation failed:', error.message);
    throw error;
  }
}

/**
 * Get interaction metadata from messages and stats
 * @param {string} interactionId - Interaction ID
 * @param {Array} messages - Messages array
 * @param {Object} conversationStats - Conversation statistics
 * @returns {Object} Interaction metadata
 */
async function getInteractionMetadata(interactionId, messages, conversationStats, channel = 'unknown', interaction) {
  try {
    // Extract basic info from messages
    
    const firstMessage = messages[0];
    
    // Find agent and customer messages using messageService
    const agentMessage = messages.find(m => messageService.determineSpeakerRole(m).role === 'agent');
    const customerMessage = messages.find(m => messageService.determineSpeakerRole(m).role === 'customer');
    
    const agent = {
      id: interaction?.agent.id || 'unknown',
      name: interaction?.agent?.name || 'Agent'
    };
    
    const caller = {
      id: interaction?.caller?.id || 'unknown', 
      name: interaction?.caller?.name || 'Customer'
    };
    
    return {
      queue: { name: firstMessage?.queue || 'Unknown' },
      agent,
      caller,
      direction: firstMessage?.direction || 0, // Default for text conversations
      duration: conversationStats.duration || 0,
      channel,
      messageCount: messages.length,
      hasMultimedia: conversationStats.multimediaMessages > 0,
      averageResponseTime: conversationStats.averageResponseTime || 0
    };
    
  } catch (error) {
    console.warn('Error extracting interaction metadata:', error.message);
    return {
      queue: { name: 'Unknown' },
      agent: { id: 'unknown', name: 'Agent' },
      caller: { id: 'unknown', name: 'Customer' },
      direction: 0,
      duration: 0,
      channel: 'unknown',
      messageCount: 0,
      hasMultimedia: false,
      averageResponseTime: 0
    };
  }
}

module.exports = {
  processTextInteraction
};