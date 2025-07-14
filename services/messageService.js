// services/messageService.js
const mongoose = require('mongoose');

// Create a dynamic model for messages collection based on your schema
const messageSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  author: {
    name: String,
    id: String,
    role: String
  },
  status: {
    error: {
      statusCode: mongoose.Schema.Types.Mixed,
      statusText: mongoose.Schema.Types.Mixed
    },
    message: mongoose.Schema.Types.Mixed,
    remarks: mongoose.Schema.Types.Mixed
  },
  channelMessageId: String,
  message: String,
  readBy: [mongoose.Schema.Types.Mixed],
  forwarded: Boolean,
  isChild: Boolean,
  parentId: mongoose.Schema.Types.Mixed,
  queue: String,
  isDeleted: Boolean,
  interactionDirection: Number,
  interactionSource: String,
  interactionDestination: String,
  direction: Number,
  recipient: String,
  channel: String,
  extension: String,
  messageType: String,
  createdAt: Date,
  interactionId: mongoose.Schema.Types.ObjectId,
  extraPayload: {
    mediaId: String,
    threadId: String,
    sentimentAnalysis: {
      language: String,
      score: Number
    }
  },
  attachments: [{
    type: String,
    data: {
      url: String
    }
  }],
  updatedAt: Date,
  __v: Number
}, { 
  collection: 'messages',
  strict: false 
});

const Message = mongoose.model('Message', messageSchema);

const messageService = {
  /**
   * Fetch all messages for a given interaction ID
   * @param {string} interactionId - The interaction ID to fetch messages for
   * @returns {Array} Array of messages sorted by creation time
   */
  async getMessagesByInteractionId(interactionId) {
    try {
      console.log(`\n=== Message Service: Fetching messages for interaction ${interactionId} ===`);
      
      // Convert string ID to ObjectId for querying
      const objectId = new mongoose.Types.ObjectId(interactionId);
      
      const messages = await Message.find({ 
        interactionId: objectId,
        isDeleted: { $ne: true }
      })
      .sort({ createdAt: 1 }) // Sort chronologically
      .lean();
      
      console.log(`Found ${messages.length} messages for interaction ${interactionId}`);
      
      return messages;
    } catch (error) {
      console.error(`Error fetching messages for interaction ${interactionId}:`, error);
      return [];
    }
  },

  /**
   * Get message counts for multiple interactions efficiently
   * @param {Array} interactionIds - Array of interaction IDs to count messages for
   * @returns {Object} Map of interactionId -> messageCount
   */
  async getMessageCountsForInteractions(interactionIds) {
    try {
      if (!interactionIds || interactionIds.length === 0) {
        return {};
      }

      console.log(`\n=== Message Service: Counting messages for ${interactionIds.length} interactions ===`);
      
      // Convert string IDs to ObjectIds
      const objectIds = interactionIds.map(id => new mongoose.Types.ObjectId(id));
      
      // Use MongoDB aggregation for efficient counting
      const messageCounts = await Message.aggregate([
        {
          // Match messages for our interactions
          $match: {
            interactionId: { $in: objectIds },
            isDeleted: { $ne: true }
          }
        },
        {
          // Group by interactionId and count
          $group: {
            _id: '$interactionId',
            messageCount: { $sum: 1 }
          }
        }
      ]);
      
      // Convert to a map for quick lookup
      const countMap = messageCounts.reduce((map, item) => {
        map[item._id.toString()] = item.messageCount;
        return map;
      }, {});
      
      console.log(`Counted messages for ${messageCounts.length} interactions with messages`);
      
      return countMap;
    } catch (error) {
      console.error('Error counting messages for interactions:', error);
      return {};
    }
  },

  /**
   * Get message count for a single interaction
   * @param {string} interactionId - The interaction ID
   * @returns {number} Message count
   */
  async getMessageCountForInteraction(interactionId) {
    try {
      const objectId = new mongoose.Types.ObjectId(interactionId);
      
      const count = await Message.countDocuments({
        interactionId: objectId,
        isDeleted: { $ne: true }
      });
      
      return count;
    } catch (error) {
      console.error(`Error counting messages for interaction ${interactionId}:`, error);
      return 0;
    }
  },
  
  /**
   * Convert messages to conversation text format
   * @param {Array} messages - Array of message objects
   * @returns {Object} Formatted conversation object
   */
  formatMessagesAsConversation(messages) {
    try {
      console.log(`\n=== Message Service: Formatting ${messages.length} messages as conversation ===`);
      
      const conversation = {
        transcription: [],
        metadata: {
          totalMessages: messages.length,
          participants: new Set(),
          channels: new Set(),
          hasMultimedia: false,
          timespan: {
            start: null,
            end: null
          }
        }
      };

      messages.forEach((message, index) => {
        // Track participants and channels
        if (message.author?.name) {
          conversation.metadata.participants.add(message.author.name);
        }
        if (message.channel) {
          conversation.metadata.channels.add(message.channel);
        }

        // Track timespan
        if (message.createdAt) {
          const messageTime = new Date(message.createdAt);
          if (!conversation.metadata.timespan.start || messageTime < conversation.metadata.timespan.start) {
            conversation.metadata.timespan.start = messageTime;
          }
          if (!conversation.metadata.timespan.end || messageTime > conversation.metadata.timespan.end) {
            conversation.metadata.timespan.end = messageTime;
          }
        }

        // Check for multimedia
        if (message.attachments && message.attachments.length > 0) {
          conversation.metadata.hasMultimedia = true;
        }

        // Create conversation entry
        const timestamp = message.createdAt ? new Date(message.createdAt).getTime() : Date.now();
        const speaker = this.determineSpeakerRole(message);
        
        let messageText = '';
        
        // Handle different message types
        if (message.messageType === 'text' && message.message) {
          messageText = message.message;
        } else if (message.messageType === 'multimedia') {
          // Describe multimedia content
          messageText = this.describeMultimediaContent(message.attachments);
        } else {
          messageText = '[Message content not available]';
        }

        // Skip empty messages
        if (!messageText.trim()) {
          return;
        }

        const conversationEntry = {
          [timestamp]: {
            channel: message.channel || 'unknown',
            speaker_id: speaker.id,
            speaker_role: speaker.role,
            original_text: messageText,
            message_type: message.messageType || 'text',
            forwarded: message.forwarded || false,
            attachments: message.attachments || []
          }
        };

        conversation.transcription.push(conversationEntry);
      });

      // Convert Sets to Arrays for JSON serialization
      conversation.metadata.participants = Array.from(conversation.metadata.participants);
      conversation.metadata.channels = Array.from(conversation.metadata.channels);

      console.log(`Formatted conversation with ${conversation.transcription.length} entries`);
      console.log(`Participants: ${conversation.metadata.participants.join(', ')}`);
      console.log(`Channels: ${conversation.metadata.channels.join(', ')}`);
      
      return conversation;
    } catch (error) {
      console.error('Error formatting messages as conversation:', error);
      return {
        transcription: [],
        metadata: {
          totalMessages: 0,
          participants: [],
          channels: [],
          hasMultimedia: false,
          timespan: { start: null, end: null }
        }
      };
    }
  },

  /**
   * Determine speaker role and ID from message
   * @param {Object} message - Message object
   * @returns {Object} Speaker information
   */
  determineSpeakerRole(message) {
    // If author role is explicitly set, use it
    if (message.author?.role) {
      return {
        id: `${message.author.role}_${message.author.id || 'unknown'}`,
        role: message.author.role,
        name: message.author.name || 'Unknown'
      };
    }

    // Determine role based on direction and recipient
    // direction: 0 = incoming (customer to agent), 1 = outgoing (agent to customer)
    const isIncoming = message.direction === 0;
    
    if (isIncoming) {
      return {
        id: `customer_${message.author?.id || message.interactionSource || 'unknown'}`,
        role: 'customer',
        name: message.author?.name || 'Customer'
      };
    } else {
      return {
        id: `agent_${message.recipient || message.interactionDestination || 'unknown'}`,
        role: 'agent',
        name: message.author?.name || 'Agent'
      };
    }
  },

  /**
   * Describe multimedia content for conversation context
   * @param {Array} attachments - Array of attachment objects
   * @returns {string} Description of multimedia content
   */
  describeMultimediaContent(attachments) {
    if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
      return '[Multimedia message]';
    }

    const descriptions = attachments.map(attachment => {
      switch (attachment.type) {
        case 'image':
          return '[Image shared]';
        case 'video':
          return '[Video shared]';
        case 'audio':
          return '[Voice message]';
        case 'document':
          return '[Document shared]';
        case 'location':
          return '[Location shared]';
        default:
          return `[${attachment.type || 'File'} shared]`;
      }
    });

    return descriptions.join(' ');
  },

  /**
   * Get conversation summary statistics
   * @param {Array} messages - Array of message objects
   * @returns {Object} Summary statistics
   */
  getConversationStats(messages) {
    const stats = {
      totalMessages: messages.length,
      customerMessages: 0,
      agentMessages: 0,
      multimediaMessages: 0,
      textMessages: 0,
      duration: 0,
      averageResponseTime: 0
    };

    if (messages.length === 0) return stats;

    // Calculate stats
    let agentResponseTimes = [];
    let lastCustomerMessageTime = null;

    messages.forEach(message => {
      const speaker = this.determineSpeakerRole(message);
      
      if (speaker.role === 'customer') {
        stats.customerMessages++;
        lastCustomerMessageTime = new Date(message.createdAt);
      } else if (speaker.role === 'agent') {
        stats.agentMessages++;
        
        // Calculate response time if there was a previous customer message
        if (lastCustomerMessageTime) {
          const responseTime = new Date(message.createdAt) - lastCustomerMessageTime;
          agentResponseTimes.push(responseTime);
          lastCustomerMessageTime = null; // Reset after calculating response time
        }
      }

      if (message.messageType === 'multimedia') {
        stats.multimediaMessages++;
      } else {
        stats.textMessages++;
      }
    });

    // Calculate duration
    if (messages.length > 1) {
      const firstMessage = new Date(messages[0].createdAt);
      const lastMessage = new Date(messages[messages.length - 1].createdAt);
      stats.duration = (lastMessage - firstMessage) / 1000; // Duration in seconds
    }

    // Calculate average response time
    if (agentResponseTimes.length > 0) {
      stats.averageResponseTime = agentResponseTimes.reduce((sum, time) => sum + time, 0) / agentResponseTimes.length / 1000; // In seconds
    }

    return stats;
  }
};

module.exports = messageService;