// routes/interactions.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { Interactions } = require('../config/mongodb');
const mongoose = require('mongoose');
const TEXT_CHANNELS = ['whatsapp', 'fb_messenger', 'instagram_dm', 'chat', 'email'];
const messageService = require('../services/messageService');
const emailService = require('../services/emailService');

router.use(authenticateToken);

// Search interactions based on criteria
router.post('/search', async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      queues,
      agents,
      minDuration,
      durationComparison,
      workCodes,
      qaFormId,
      excludeEvaluated,
      direction,
      channels
    } = req.body;

    // Build query object (same as before)
    const query = {};

    if (excludeEvaluated === true) {
      query['extraPayload.evaluated'] = { $ne: true };
    }
    
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (queues && queues.length > 0) {
      const isNumericIds = queues.some(q => !isNaN(parseInt(q)));
      if (isNumericIds) {
        query['queue.id'] = { $in: queues.map(id => parseInt(id)) };
      } else {
        query['queue.name'] = { $in: queues };
      }
    }

    if (agents && agents.length > 0) {
      query['agent.id'] = { $in: agents.map(id => parseInt(id)) };
    }

    if (minDuration !== undefined && minDuration !== null) {
      switch (durationComparison) {
        case '>':
          query['connect.duration'] = { $gt: parseInt(minDuration) };
          break;
        case '<':
          query['connect.duration'] = { $lt: parseInt(minDuration) };
          break;
        case '=':
          query['connect.duration'] = parseInt(minDuration);
          break;
        default:
          query['connect.duration'] = { $gt: parseInt(minDuration) };
      }
    }

    if (workCodes && workCodes.length > 0) {
      query['workCodes.id'] = { $in: workCodes.map(String) };
    }

    if (direction && direction !== 'all') {
      query['direction'] = parseInt(direction);
    }
    
    if (channels && channels.length > 0) {
      query['channel'] = { $in: channels };
    }
    
    // Enhanced recording requirement logic
    const $orConditions = [];
    
    $orConditions.push({
      $and: [
        { 
          $or: [
            { 'channel': { $exists: false } },
            { 'channel': 'call' },
            { 'channel': { $nin: TEXT_CHANNELS } }
          ]
        },
        { 'extraPayload.callRecording.webPath': { $exists: true, $ne: null } }
      ]
    });
    
    $orConditions.push({
      'channel': { $in: TEXT_CHANNELS }
    });
    
    query['$or'] = $orConditions;

    console.log('Searching interactions with query:', JSON.stringify(query, null, 2));
    
    // Step 1: Find interactions
    const interactions = await Interactions.find(query)
      .sort({ createdAt: -1 })
      .lean();

    console.log(`Found ${interactions.length} interactions`);

    // Step 2: OPTIMIZED message counting for text channels only
    const textChannelInteractions = interactions.filter(interaction => 
      TEXT_CHANNELS.includes(interaction.channel)
    );
    
    let messageCountMap = {};
    
    if (textChannelInteractions.length > 0) {
      // Separate email interactions from other text channels
      const emailInteractions = textChannelInteractions.filter(i => i.channel === 'email');
      const otherTextInteractions = textChannelInteractions.filter(i => i.channel !== 'email');
      
      // Get message counts for non-email text channels
      if (otherTextInteractions.length > 0) {
        const textChannelIds = otherTextInteractions.map(interaction => interaction._id.toString());
        const messageCounts = await messageService.getMessageCountsForInteractions(textChannelIds);
        Object.assign(messageCountMap, messageCounts);
      }
      
      // Get email counts for email channel
      if (emailInteractions.length > 0) {
        const emailIds = emailInteractions.map(interaction => interaction._id.toString());
        const emailCounts = await emailService.countEmailsForInteractions(emailIds);
        Object.assign(messageCountMap, emailCounts);
      }
    }

    // Step 3: Enhance the results with metadata
    const enhancedInteractions = interactions.map(interaction => {
      const isTextChannel = TEXT_CHANNELS.includes(interaction.channel);
      
      return {
        ...interaction,
        // Add processing metadata
        processingType: isTextChannel ? 'text' : 'audio',
        hasRecording: !!(interaction.extraPayload?.callRecording?.webPath || interaction.extraPayload?.callRecording?.webPathQA),
        isTextChannel,
        // OPTIMIZED: Get message count from our efficient aggregation
        messageCount: isTextChannel ? (messageCountMap[interaction._id.toString()] || 0) : 0
      };
    });

    console.log(`Enhanced ${enhancedInteractions.length} interactions`);
    
    // Log statistics
    const stats = {
      total: enhancedInteractions.length,
      textChannels: enhancedInteractions.filter(i => i.isTextChannel).length,
      audioChannels: enhancedInteractions.filter(i => !i.isTextChannel).length,
      withMessages: enhancedInteractions.filter(i => i.messageCount > 0).length
    };
    
    console.log('Search statistics:', stats);
    
    res.json(enhancedInteractions);
  } catch (error) {
    console.error('Error searching interactions:', error);
    res.status(500).json({ message: 'Error searching interactions', error: error.message });
  }
});

router.get('/channels', async (req, res) => {
  try {
    console.log('Fetching available channels...');
    
    // Get distinct channels from interactions collection
    const channels = [...TEXT_CHANNELS, 'call']; //await Interactions.distinct('channel');
    
    // Filter out null/undefined and format
    const formattedChannels = channels
      .filter(channel => channel && channel.trim())
      .map(channel => ({
        id: channel,
        name: formatChannelName(channel),
        type: TEXT_CHANNELS.includes(channel) ? 'text' : 'audio',
        requiresRecording: !TEXT_CHANNELS.includes(channel)
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    console.log(`Found channels: ${formattedChannels.map(c => c.name).join(', ')}`);
    
    res.json(formattedChannels);
  } catch (error) {
    console.error('Error fetching channels:', error);
    res.status(500).json({ message: 'Error fetching channels', error: error.message });
  }
});

// Helper function to format channel names
function formatChannelName(channel) {
  const channelNames = {
    'call': 'Voice Call',
    'whatsapp': 'WhatsApp',
    'fb_messenger': 'Facebook Messenger',
    'facebook': 'Facebook Comments',
    'instagram_dm': 'Instagram DM',
    'email': 'Email',
    'chat': 'Live Chat',
    'sms': 'SMS'
  };
  
  return channelNames[channel] || channel.charAt(0).toUpperCase() + channel.slice(1);
}

// NEW ROUTE: Get messages for a specific interaction (for text channels)
router.get('/:interactionId/messages', async (req, res) => {
  try {
    const { interactionId } = req.params;
    
    const interaction = await Interactions.findById(interactionId).lean();
    
    if (!interaction) {
      return res.status(404).json({ message: 'Interaction not found' });
    }
    
    let messages, conversation, stats;

    if (interaction.channel === 'email') {
      console.log('Using email service for email channel');
      
      // Get emails for this interaction
      messages = await emailService.getEmailsByInteractionId(interactionId);
      
      if (!messages || messages.length === 0) {
        return res.status(404).json({ message: 'No emails found for this interaction' });
      }
      
      // Format emails as conversation (same structure as messages)
      conversation = emailService.formatEmailsAsConversation(messages);
      stats = emailService.getConversationStats(messages);
      
    } else {

      console.log(`Fetching messages for interaction: ${interactionId}`);
      
      // Import message service
      const messageService = require('../services/messageService');
      
      // Get messages for this interaction
      messages = await messageService.getMessagesByInteractionId(interactionId);
      
      if (!messages || messages.length === 0) {
        return res.status(404).json({ message: 'No messages found for this interaction' });
      }
      
      // Format messages as conversation
      conversation = messageService.formatMessagesAsConversation(messages);
      stats = messageService.getConversationStats(messages);
    }
    
    res.json({
      messages,
      conversation,
      stats,
      count: messages.length
    });
    
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Error fetching messages', error: error.message });
  }
});

router.get('/:interactionId/details', async (req, res) => {
  try {
    const { interactionId } = req.params;
    
    console.log(`Fetching details for interaction: ${interactionId}`);
    
    // Get interaction
    const interaction = await Interactions.findById(interactionId).lean();
    
    if (!interaction) {
      return res.status(404).json({ message: 'Interaction not found' });
    }
    
    const isTextChannel = TEXT_CHANNELS.includes(interaction.channel);
    
    // Enhance with channel-specific data
    const enhancedInteraction = {
      ...interaction,
      processingType: isTextChannel ? 'text' : 'audio',
      hasRecording: !!(interaction.extraPayload?.callRecording?.webPath || interaction.extraPayload?.callRecording?.webPathQA),
      isTextChannel,
      channelDisplayName: formatChannelName(interaction.channel)
    };
    
    // For text channels, also include message count
    if (isTextChannel) {
      if (interaction.channel === 'email') {
        // Use email service for email channel
        const emails = await emailService.getEmailsByInteractionId(interactionId);
        enhancedInteraction.messageCount = emails.length;
        enhancedInteraction.hasMessages = emails.length > 0;
      } else {
        // Use message service for other text channels
        const messages = await messageService.getMessagesByInteractionId(interactionId);
        enhancedInteraction.messageCount = messages.length;
        enhancedInteraction.hasMessages = messages.length > 0;
      }
    }
    
    res.json(enhancedInteraction);
    
  } catch (error) {
    console.error('Error fetching interaction details:', error);
    res.status(500).json({ message: 'Error fetching interaction details', error: error.message });
  }
});

router.get('/:interactionId/recording', async (req, res) => {
  try {
    const { interactionId } = req.params;
    
    console.log(`Fetching recording details for interaction: ${interactionId}`);
    
    // Get interaction
    const interaction = await Interactions.findById(interactionId).lean();
    
    if (!interaction) {
      return res.status(404).json({ message: 'Interaction not found' });
    }
    
    // Check if this is an audio channel
    const isTextChannel = TEXT_CHANNELS.includes(interaction.channel);
    if (isTextChannel) {
      return res.status(400).json({ message: 'This interaction is not an audio channel' });
    }
    
    // Extract recording information
    const recordingData = {
      interactionId: interaction._id,
      hasRecording: false,
      recordingUrl: null,
      recordingType: null,
      duration: null,
      agent: {
        id: interaction.agent?.id,
        name: interaction.agent?.name
      },
      caller: {
        id: interaction.caller?.id
      },
      timestamps: {
        createdAt: interaction.createdAt,
        queueDuration: interaction.timestamps?.queueDuration,
        talkDuration: interaction.timestamps?.talkDuration,
        wrapUpDuration: interaction.timestamps?.wrapUpDuration
      },
      channel: interaction.channel,
      direction: interaction.direction
    };
    
    // Check for recording in different locations
    if (interaction.extraPayload?.callRecording?.webPathQA) {
      recordingData.hasRecording = true;
      recordingData.recordingUrl = interaction.extraPayload.callRecording.webPathQA;
      recordingData.recordingType = 'QA';
    } else if (interaction.extraPayload?.callRecording?.webPath) {
      recordingData.hasRecording = true;
      recordingData.recordingUrl = interaction.extraPayload.callRecording.webPath;
      recordingData.recordingType = 'standard';
    } else if (interaction.recording?.webPath) {
      recordingData.hasRecording = true;
      recordingData.recordingUrl = interaction.recording.webPath;
      recordingData.recordingType = 'legacy';
    }
    
    // Add duration information
    if (interaction.connect?.duration) {
      recordingData.duration = interaction.connect.duration;
    } else if (interaction.timestamps?.talkDuration) {
      recordingData.duration = interaction.timestamps.talkDuration;
    }
    
    res.json({
      success: true,
      recording: recordingData
    });
    
  } catch (error) {
    console.error('Error fetching recording details:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching recording details', 
      error: error.message 
    });
  }
});

router.get('/:interactionId/summary', async (req, res) => {
  try {
    const { interactionId } = req.params;
    
    console.log(`Fetching interaction summary: ${interactionId}`);
    
    // Get interaction
    const interaction = await Interactions.findById(interactionId).lean();
    
    if (!interaction) {
      return res.status(404).json({ message: 'Interaction not found' });
    }
    
    const isTextChannel = TEXT_CHANNELS.includes(interaction.channel);
    
    // Build summary object
    const summary = {
      _id: interaction._id,
      channel: interaction.channel,
      isTextChannel,
      agent: interaction.agent,
      caller: interaction.caller,
      queue: interaction.queue,
      createdAt: interaction.createdAt,
      direction: interaction.direction,
      workCodes: interaction.workCodes
    };
    
    // Add channel-specific data
    if (isTextChannel) {
      // Get message/email count
      if (interaction.channel === 'email') {
        const emailCount = await emailService.countEmailsForInteraction(interactionId);
        summary.messageCount = emailCount;
        summary.contentType = 'emails';
      } else {
        const messageCount = await messageService.getMessageCountForInteraction(interactionId);
        summary.messageCount = messageCount;
        summary.contentType = 'messages';
      }
    } else {
      // Add recording info for audio channels
      summary.hasRecording = !!(
        interaction.extraPayload?.callRecording?.webPathQA || 
        interaction.extraPayload?.callRecording?.webPath ||
        interaction.recording?.webPath
      );
      summary.duration = interaction.connect?.duration || interaction.timestamps?.talkDuration;
      summary.timestamps = interaction.timestamps;
      summary.extraPayload = interaction.extraPayload;
      summary.recording = interaction.recording;
    }
    
    res.json({
      success: true,
      interaction: summary
    });
    
  } catch (error) {
    console.error('Error fetching interaction summary:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching interaction summary', 
      error: error.message 
    });
  }
});

module.exports = router;