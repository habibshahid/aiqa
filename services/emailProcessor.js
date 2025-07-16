// services/emailProcessor.js
const axios = require('axios');
const { InteractionTranscription, QAForm, Interactions, InteractionAIQA } = require('../config/mongodb');
const emailService = require('./emailService');
const { calculateEvaluationCost } = require('./costProcessor');
const { processEvaluationResponse, updateEvaluationForClassification } = require('./qaProcessor');
const mongoose = require('mongoose');

/**
 * Format QA form parameters into instructions for AI evaluation - Email specific
 * @param {Object} form - QA form data
 * @returns {string} Formatted instructions for AI evaluation
 */
function formatInstructionsForEmail(form) {
  let instructions = `You are a quality analyst evaluating an email interaction.`;

  instructions += 'Based on the following evaluation criteria, please assess the email interaction and provide scores:\n\n';

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

  // Add specific instructions for email interactions
  instructions += '\nNote: This is an email interaction. Please consider:\n';
  instructions += '- Professional tone and language in written communication\n';
  instructions += '- Clarity and completeness of email responses\n';
  instructions += '- Appropriate use of email etiquette (subject lines, signatures, etc.)\n';
  instructions += '- Timely responses to customer inquiries\n';
  instructions += '- Proper handling of email threads and context\n';
  instructions += '- Effective resolution of customer issues via email\n\n';

  instructions += 'areasOfImprovements: find the things the agent could have done better. It should be in an array\n';
  instructions += 'whatTheAgentDidWell: find the areas where the agent did well in the interaction. It should be in an array\n';
  instructions += 'Please provide your evaluation with a score for each question, along with an explanation of your reasoning. Also include an overall assessment of the interaction.\n';
  
  // Additional instructions for handling question classifications
  instructions += '\nassign a classification tag to the question response. The classification tags are none, minor, moderate, major. If the instructions have none then do not apply any classification';
  instructions += '\nwhen returning the response do not include the text Question in parameter name, just the label name';
  
  if (process.env.AIQA_SAMPLE_RESPONSE) {
    instructions += process.env.AIQA_SAMPLE_RESPONSE;
  }
  
  console.log('Formatted Email Instructions:', instructions);
  return instructions;
}

/**
 * Create formatted conversation text for AI analysis from emails
 * @param {Object} conversation - Formatted conversation object from emailService
 * @param {Array} emails - Original emails array
 * @returns {string} Formatted conversation text
 */
async function createEmailConversationText(conversation, emails) {
  console.log(`Creating email conversation text from ${emails.length} emails`);
  
  let conversationText = '';
  
  // Add conversation header
  conversationText += `=== EMAIL CONVERSATION TRANSCRIPT ===\n`;
  conversationText += `Channel: Email\n`;
  conversationText += `Total Emails: ${emails.length}\n`;
  
  // Add thread information if available
  if (conversation.metadata.threadInfo && conversation.metadata.threadInfo.threadId) {
    conversationText += `Thread ID: ${conversation.metadata.threadInfo.threadId}\n`;
  }
  
  // Calculate duration if we have emails
  if (emails.length > 1) {
    const firstEmail = new Date(emails[0].createdAt || emails[0].receivedAt);
    const lastEmail = new Date(emails[emails.length - 1].createdAt || emails[emails.length - 1].receivedAt);
    const duration = Math.round((lastEmail - firstEmail) / 1000);
    conversationText += `Duration: ${duration} seconds\n`;
  }
  
  conversationText += `\n=== EMAIL THREAD ===\n`;

  // Add each email with timestamp and metadata
  emails.forEach((email, index) => {
    const emailTime = new Date(email.createdAt || email.receivedAt);
    const timeString = emailTime.toLocaleString();
    
    // Use emailService to determine speaker role
    const speaker = emailService.determineSpeakerRole(email);
    const speakerLabel = speaker.role === 'customer' ? 'CUSTOMER' : 'AGENT';
    
    conversationText += `\n[${timeString}] ${speakerLabel} (${speaker.name}):\n`;
    
    // Add subject if it's the first email or if subject changes
    if (index === 0 || email.subject) {
      conversationText += `Subject: ${email.subject || 'No Subject'}\n`;
    }
    
    // Add from/to information
    if (email.from && email.from.length > 0) {
      conversationText += `From: ${email.from[0].name || email.from[0].address}\n`;
    }
    
    if (email.to && email.to.length > 0) {
      const toList = email.to.map(recipient => recipient.name || recipient.address).join(', ');
      conversationText += `To: ${toList}\n`;
    }
    
    // Add reply context if applicable
    if (email.inReplyTo) {
      conversationText += `[In reply to: ${email.inReplyTo}]\n`;
    }
    
    // Add forwarded indicator
    if (email.forward) {
      conversationText += `[FORWARDED EMAIL]\n`;
    }
    
    conversationText += `\n${email.text || '[No content]'}\n`;
    
    // Add attachment information
    if (email.attachments && email.attachments.length > 0) {
      conversationText += `\n[Attachments: ${email.attachments.length} file(s)]\n`;
      email.attachments.forEach((attachment, attIndex) => {
        conversationText += `  - ${attachment.data?.extension || 'unknown'} file\n`;
      });
    }
    
    conversationText += `\n${'='.repeat(50)}\n`;
  });
  
  return conversationText;
}

/**
 * Perform sentiment analysis on email conversation
 * @param {string} conversationText - Email conversation text
 * @returns {Object} Sentiment analysis results
 */
async function performEmailSentimentAnalysis(conversationText) {
  // Use the same sentiment analysis as messages, but with email-specific handling
  try {
    // This would connect to your sentiment analysis service
    // For now, return a basic structure
    return {
      overallSentiment: 'neutral',
      sentimentScore: 0.0,
      customerSentiment: 'neutral',
      agentSentiment: 'neutral',
      emotionalTone: 'professional',
      keyPhrases: [],
      language: 'en'
    };
  } catch (error) {
    console.warn('Email sentiment analysis failed:', error.message);
    return getDefaultSentimentAnalysis(conversationText);
  }
}

/**
 * Get default sentiment analysis for emails
 * @param {string} conversationText - Email conversation text
 * @returns {Object} Default sentiment analysis
 */
function getDefaultSentimentAnalysis(conversationText) {
  return {
    overallSentiment: 'neutral',
    sentimentScore: 0.0,
    customerSentiment: 'neutral',
    agentSentiment: 'neutral',
    emotionalTone: 'professional',
    keyPhrases: [],
    language: 'en',
    confidence: 0.5,
    wordCount: conversationText.split(' ').length
  };
}

/**
 * Save email conversation transcription
 * @param {string} interactionId - Interaction ID
 * @param {Object} conversation - Formatted conversation object
 * @param {Object} sentimentAnalysis - Sentiment analysis results
 */
async function saveEmailConversationTranscription(interactionId, conversation, sentimentAnalysis) {
  try {
    console.log(`Saving email conversation transcription for interaction: ${interactionId}`);
    
    const transcriptionDoc = {
      interactionId: new mongoose.Types.ObjectId(interactionId),
      conversationType: 'email',
      transcription: conversation.messages.map(msg => ({
        timestamp: msg.timestamp,
        speaker: msg.speaker,
        speakerName: msg.speakerName,
        content: msg.content,
        metadata: msg.metadata
      })),
      metadata: {
        ...conversation.metadata,
        sentimentAnalysis,
        processingDate: new Date(),
        totalEmails: conversation.messages.length,
        conversationDuration: conversation.metadata.conversationDuration || 0
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Update or create transcription
    const existingTranscription = await InteractionTranscription.findOne({ interactionId });
    
    if (existingTranscription) {
      await InteractionTranscription.updateOne(
        { interactionId },
        { $set: transcriptionDoc }
      );
      console.log('Updated existing email transcription');
    } else {
      await InteractionTranscription.create(transcriptionDoc);
      console.log('Created new email transcription');
    }
    
  } catch (error) {
    console.error('Error saving email conversation transcription:', error);
    throw error;
  }
}

/**
 * Get interaction metadata from emails and stats
 * @param {string} interactionId - Interaction ID
 * @param {Array} emails - Emails array
 * @param {Object} conversationStats - Conversation statistics
 * @returns {Object} Interaction metadata
 */
async function getEmailInteractionMetadata(interactionId, emails, conversationStats) {
  try {
    console.log(`Getting email interaction metadata for: ${interactionId}`);
    
    // Get interaction details
    const interaction = await Interactions.findById(interactionId).lean();
    
    if (!interaction) {
      throw new Error(`Interaction not found: ${interactionId}`);
    }
    
    // Determine primary agent from emails
    const agentEmails = emails.filter(email => {
      const speaker = emailService.determineSpeakerRole(email);
      return speaker.role === 'agent';
    });
    
    const primaryAgent = agentEmails.length > 0 ? agentEmails[0].author : null;
    
    // Determine primary customer from emails  
    const customerEmails = emails.filter(email => {
      const speaker = emailService.determineSpeakerRole(email);
      return speaker.role === 'customer';
    });
    
    const primaryCustomer = customerEmails.length > 0 ? customerEmails[0].from[0] : null;
    
    return {
      agent: {
        id: primaryAgent?.id || interaction.agent?.id || 'unknown',
        name: primaryAgent?.name || interaction.agent?.name || 'Unknown Agent',
        email: primaryAgent?.id || 'unknown'
      },
      caller: {
        id: primaryCustomer?.address || interaction.caller?.number || 'unknown',
        name: primaryCustomer?.name || interaction.caller?.name || 'Unknown Customer',
        email: primaryCustomer?.address || 'unknown'
      },
      channel: 'email',
      direction: interaction.direction || 'inbound',
      duration: conversationStats.conversationDuration || 0,
      queue: interaction.queue || { name: 'Default Queue' },
      metadata: {
        emailCount: conversationStats.totalEmails,
        hasAttachments: conversationStats.emailsWithAttachments > 0,
        threadLength: conversationStats.threadLength,
        uniqueSubjects: conversationStats.uniqueSubjects,
        averageResponseTime: conversationStats.averageResponseTime
      }
    };
  } catch (error) {
    console.error('Error getting email interaction metadata:', error);
    throw error;
  }
}

/**
 * Process email interaction for AI QA evaluation
 * @param {Object} evaluation - Evaluation data containing interactionId, qaFormId, evaluator
 * @returns {Object} Processing result
 */
async function processEmailInteraction(evaluation) {
  const { interactionId, qaFormId, evaluator } = evaluation;
  
  console.log(`\n=== Email Processor: Starting email interaction processing for ${interactionId} ===`);
  
  try {
    // Step 1: Get emails from email service
    console.log('Step 1: Fetching emails from email service...');
    const emails = await emailService.getEmailsByInteractionId(interactionId);
    
    if (!emails || emails.length === 0) {
      throw new Error(`No emails found for interaction ${interactionId}`);
    }
    
    console.log(`Found ${emails.length} emails for interaction ${interactionId}`);

    // Step 2: Format emails into conversation using emailService
    console.log('Step 2: Formatting emails into conversation...');
    const conversation = emailService.formatEmailsAsConversation(emails);
    
    // Step 3: Generate conversation stats using emailService
    console.log('Step 3: Generating conversation statistics...');
    const conversationStats = emailService.getConversationStats(emails);
    
    // Step 4: Create conversation text for AI analysis
    console.log('Step 4: Creating conversation text for AI analysis...');
    const conversationText = await createEmailConversationText(conversation, emails);
    
    // Step 5: Perform sentiment analysis
    console.log('Step 5: Performing sentiment analysis...');
    let sentimentAnalysis;
    try {
      sentimentAnalysis = await performEmailSentimentAnalysis(conversationText);
    } catch (sentimentError) {
      console.warn('Sentiment analysis failed, using defaults:', sentimentError.message);
      sentimentAnalysis = getDefaultSentimentAnalysis(conversationText);
    }

    // Step 6: Save conversation as transcription
    console.log('Step 6: Saving conversation transcription...');
    await saveEmailConversationTranscription(interactionId, conversation, sentimentAnalysis);

    // Step 7: Get QA form and format instructions
    console.log('Step 7: Getting QA form and formatting instructions...');
    const qaForm = await QAForm.findById(qaFormId);
    if (!qaForm) {
      throw new Error(`QA Form not found: ${qaFormId}`);
    }

    const formattedQAForm = {
      formId: qaForm._id,
      formName: qaForm.name,
      interactionType: 'email_conversation',
      parameters: qaForm.parameters.map(param => ({
        label: param.name,
        evaluationContext: param.context,
        maxScore: param.maxScore,
        scoringType: param.scoringType,
        classification: param.classification
      })),
      classifications: qaForm.classifications 
    };

    const instructions = formatInstructionsForEmail(formattedQAForm);

    // Step 8: Send to AI evaluation service
    console.log('Step 8: Sending to AI evaluation service...');
    const evaluationResult = await sendToAIEvaluation(conversationText, instructions, sentimentAnalysis);

    // Step 9: Get interaction metadata
    console.log('Step 9: Getting interaction metadata...');
    const interactionMetadata = await getEmailInteractionMetadata(interactionId, emails, conversationStats);

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

    // Step 11: Calculate and log costs
    console.log('Step 11: Calculating evaluation costs...');
    const cost = calculateEvaluationCost(conversationText, 'email');
    console.log(`Email evaluation cost: $${cost.toFixed(4)}`);

    // Step 12: Insert into collection
    console.log('Step 12: Inserting evaluation into database...');
    const result = await InteractionAIQA.create(processedDocument);

    // Step 13: Mark interaction as evaluated
    console.log('Step 13: Marking interaction as evaluated...');
    await Interactions.updateOne(
      { _id: interactionId },
      { 
        $set: { 
          'extraPayload.evaluated': true,
          'extraPayload.evaluationDate': new Date(),
          'extraPayload.evaluationType': 'email'
        }
      }
    );

    console.log(`✅ Email interaction processing completed successfully for ${interactionId}`);
    
    return {
      success: true,
      evaluationId: result._id,
      interactionId,
      cost,
      emailCount: emails.length,
      processingTime: new Date(),
      stats: conversationStats
    };

  } catch (error) {
    console.error(`❌ Email interaction processing failed for ${interactionId}:`, error);
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
    console.log('Sending email conversation to AI evaluation service...');
    
    const evaluationUrl = process.env.QAEVALUATION_URL || 'http://democc.contegris.com:60027/aiqa';
    
    const response = await axios.post(evaluationUrl, {
      text: conversationText,
      instructions: instructions,
      metadata: {
        interactionType: 'email',
        sentimentAnalysis: sentimentAnalysis
      }
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

module.exports = {
  processEmailInteraction,
  formatInstructionsForEmail,
  createEmailConversationText,
  performEmailSentimentAnalysis,
  saveEmailConversationTranscription,
  getEmailInteractionMetadata,
  sendToAIEvaluation
};