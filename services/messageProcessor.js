// services/messageProcessor.js
const axios = require('axios');
const { InteractionAIQA, InteractionTranscription, QAForm } = require('../config/mongodb');
const messageService = require('./messageService');

// Text-based channels that should use message processing
const TEXT_CHANNELS = ['whatsapp', 'fb_messenger', 'facebook', 'instagram_dm'];

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
 * @param {string} interactionId - The interaction ID
 * @param {string} qaFormId - QA form to use for evaluation
 * @param {Object} evaluator - Evaluator information
 * @returns {Promise<Object>} Processing result
 */
async function processTextInteraction(interactionId, qaFormId, evaluator = null) {
  console.log(`\n=== Message Processor: Starting text interaction processing ===`);
  console.log(`Interaction ID: ${interactionId}`);
  console.log(`QA Form ID: ${qaFormId}`);
  console.log(`Evaluator:`, evaluator);

  try {
    // Step 1: Fetch messages for this interaction
    const messages = await messageService.getMessagesByInteractionId(interactionId);
    
    if (!messages || messages.length === 0) {
      throw new Error(`No messages found for interaction ${interactionId}`);
    }

    console.log(`Found ${messages.length} messages for processing`);

    // Step 2: Format messages as conversation
    const conversation = messageService.formatMessagesAsConversation(messages);
    const conversationStats = messageService.getConversationStats(messages);

    console.log(`Conversation stats:`, conversationStats);

    // Step 3: Create conversation text for AI analysis
    const conversationText = await createConversationText(conversation, messages);
    
    // Step 4: Perform sentiment analysis on the conversation
    const sentimentAnalysis = await performSentimentAnalysis(conversationText);

    // Step 5: Save conversation as transcription
    await saveConversationTranscription(interactionId, conversation, sentimentAnalysis);

    // Step 6: Get QA form and format instructions
    const qaForm = await QAForm.findById(qaFormId);
    if (!qaForm) {
      throw new Error(`QA Form not found: ${qaFormId}`);
    }

    const formattedQAForm = {
      formId: qaForm._id,
      formName: qaForm.name,
      interactionType: 'text_conversation', // Specify this is a text interaction
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

    // Step 7: Send to AI evaluation service
    const evaluation = await sendToAIEvaluation(conversationText, instructions, sentimentAnalysis);

    // Step 8: Get interaction metadata
    const interactionMetadata = await getInteractionMetadata(interactionId, messages, conversationStats);

    // Step 9: Save evaluation results
    const savedEvaluation = await saveEvaluationResults(
      interactionId,
      qaForm,
      evaluation,
      interactionMetadata,
      evaluator
    );

    console.log(`\n=== Message Processor: Successfully processed text interaction ${interactionId} ===`);
    
    return {
      success: true,
      interactionId,
      evaluationId: savedEvaluation._id,
      messageCount: messages.length,
      conversationStats,
      evaluation: savedEvaluation
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
 * Create formatted conversation text for AI analysis
 * @param {Object} conversation - Formatted conversation object
 * @param {Array} messages - Original messages array
 * @returns {string} Formatted conversation text
 */
async function createConversationText(conversation, messages) {
  console.log(`Creating conversation text from ${conversation.transcription.length} entries`);
  
  let conversationText = '';
  
  // Add conversation header
  conversationText += `=== CONVERSATION TRANSCRIPT ===\n`;
  conversationText += `Channel: ${conversation.metadata.channels.join(', ')}\n`;
  conversationText += `Participants: ${conversation.metadata.participants.join(', ')}\n`;
  conversationText += `Total Messages: ${conversation.metadata.totalMessages}\n`;
  conversationText += `Has Multimedia: ${conversation.metadata.hasMultimedia ? 'Yes' : 'No'}\n`;
  
  if (conversation.metadata.timespan.start && conversation.metadata.timespan.end) {
    const duration = (conversation.metadata.timespan.end - conversation.metadata.timespan.start) / 1000;
    conversationText += `Duration: ${Math.round(duration)} seconds\n`;
  }
  
  conversationText += `\n=== MESSAGES ===\n`;

  // Add each message with timestamp and speaker info
  conversation.transcription.forEach((entry, index) => {
    const timestamp = Object.keys(entry)[0];
    const messageData = entry[timestamp];
    
    // Format timestamp for readability
    const date = new Date(parseInt(timestamp));
    const timeString = date.toLocaleTimeString();
    
    // Determine speaker label
    const speakerLabel = messageData.speaker_role === 'customer' ? 'CUSTOMER' : 'AGENT';
    
    conversationText += `\n[${timeString}] ${speakerLabel}: ${messageData.original_text}`;
    
    // Add multimedia indicators
    if (messageData.attachments && messageData.attachments.length > 0) {
      const attachmentTypes = messageData.attachments.map(att => att.type).join(', ');
      conversationText += ` [Attachments: ${attachmentTypes}]`;
    }
    
    if (messageData.forwarded) {
      conversationText += ` [Forwarded]`;
    }
  });

  conversationText += `\n\n=== END TRANSCRIPT ===`;
  
  console.log(`Created conversation text: ${conversationText.length} characters`);
  
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
      translationInEnglish: conversationText,
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    };
  }
}

/**
 * Save conversation as transcription in database
 * @param {string} interactionId - Interaction ID
 * @param {Object} conversation - Formatted conversation
 * @param {Object} sentimentAnalysis - Sentiment analysis results
 */
async function saveConversationTranscription(interactionId, conversation, sentimentAnalysis) {
  try {
    console.log(`Saving conversation transcription for interaction ${interactionId}`);
    
    const transcriptionDoc = {
      interactionId,
      transcriptionVersion: 'messages',
      transcription: conversation.transcription,
      metadata: conversation.metadata,
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
async function sendToAIEvaluation(conversationText, instructions, sentimentAnalysis) {
  try {
    console.log('Sending conversation to AI evaluation service...');
    
    const evaluationUrl = process.env.QAEVALUATION_URL || 'http://democc.contegris.com:60027/aiqa';
    
    const requestPayload = {
      instructions,
      transcript: conversationText,
      sentimentData: sentimentAnalysis,
      interactionType: 'text_conversation'
    };

    const response = await axios.post(evaluationUrl, requestPayload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 120000 // 2 minute timeout for AI processing
    });

    console.log('AI evaluation completed successfully');
    return response.data;
    
  } catch (error) {
    console.error('AI evaluation failed:', error.message);
    throw new Error(`AI evaluation service error: ${error.message}`);
  }
}

/**
 * Get interaction metadata from messages
 * @param {string} interactionId - Interaction ID
 * @param {Array} messages - Messages array
 * @param {Object} conversationStats - Conversation statistics
 * @returns {Object} Interaction metadata
 */
async function getInteractionMetadata(interactionId, messages, conversationStats) {
  try {
    // Extract basic info from messages
    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];
    
    // Determine primary participants
    const customerMessage = messages.find(m => messageService.determineSpeakerRole(m).role === 'customer');
    const agentMessage = messages.find(m => messageService.determineSpeakerRole(m).role === 'agent');
    
    return {
      queue: {
        name: firstMessage.queue || 'Unknown'
      },
      agent: {
        id: agentMessage?.recipient || agentMessage?.interactionDestination || 'unknown',
        name: agentMessage?.author?.name || 'Agent'
      },
      caller: {
        id: customerMessage?.author?.id || customerMessage?.interactionSource || 'unknown',
        name: customerMessage?.author?.name || 'Customer'
      },
      direction: firstMessage.direction || 0,
      duration: conversationStats.duration,
      channel: firstMessage.channel || 'unknown',
      messageCount: conversationStats.totalMessages,
      hasMultimedia: conversationStats.multimediaMessages > 0,
      averageResponseTime: conversationStats.averageResponseTime
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

/**
 * Save evaluation results to database
 * @param {string} interactionId - Interaction ID
 * @param {Object} qaForm - QA form object
 * @param {Object} evaluation - AI evaluation results
 * @param {Object} interactionMetadata - Interaction metadata
 * @param {Object} evaluator - Evaluator information
 * @returns {Object} Saved evaluation document
 */
async function saveEvaluationResults(interactionId, qaForm, evaluation, interactionMetadata, evaluator) {
  try {
    console.log(`Saving evaluation results for interaction ${interactionId}`);
    
    const evaluationDoc = {
      interactionId,
      qaFormName: qaForm.name,
      qaFormId: qaForm._id,
      evaluator: evaluator || {
        id: 'system',
        name: 'AI System'
      },
      evaluationData: {
        usage: evaluation.usage || {},
        evaluation: evaluation.evaluation || evaluation
      },
      interactionData: interactionMetadata,
      status: 'completed',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const savedEvaluation = await InteractionAIQA.create(evaluationDoc);
    console.log(`Saved evaluation with ID: ${savedEvaluation._id}`);
    
    return savedEvaluation;
    
  } catch (error) {
    console.error('Error saving evaluation results:', error);
    throw error;
  }
}

module.exports = {
  processTextInteraction
};