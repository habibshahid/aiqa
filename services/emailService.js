// services/emailService.js
const mongoose = require('mongoose');

// Create a dynamic model for emails collection based on your schema
const emailSchema = new mongoose.Schema({
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
  text: String,
  subject: String,
  channelMessageId: String,
  inReplyTo: String,
  receivedAt: Date,
  isChild: Boolean,
  forward: Boolean,
  parentId: mongoose.Schema.Types.Mixed,
  readBy: [mongoose.Schema.Types.Mixed],
  isDeleted: Boolean,
  queue: String,
  interactionDirection: Number,
  interactionSource: String,
  interactionDestination: String,
  messageId: String,
  direction: Number,
  extension: String,
  from: [{
    name: String,
    gatewayId: String,
    address: String
  }],
  to: [{
    name: String,
    address: String,
    type: String
  }],
  attachments: [{
    type: String,
    data: {
      url: String,
      type: String,
      extension: String,
      cid: String
    }
  }],
  extraPayload: {
    threadId: String
  },
  interactionId: mongoose.Schema.Types.ObjectId,
  htmlUrl: String,
  createdAt: Date,
  updatedAt: Date,
  __v: Number
}, { 
  collection: 'emails',
  strict: false 
});

const Email = mongoose.model('Email', emailSchema);

const emailService = {
  /**
   * Fetch all emails for a given interaction ID
   * @param {string} interactionId - The interaction ID to fetch emails for
   * @returns {Array} Array of email objects
   */
  async getEmailsByInteractionId(interactionId) {
    try {
      console.log(`Fetching emails for interaction ${interactionId}`);
      
      const objectId = new mongoose.Types.ObjectId(interactionId);
      
      const emails = await Email.find({ 
        interactionId: objectId,
        isDeleted: { $ne: true }
      })
      .sort({ receivedAt: 1 })
      .lean();
      
      console.log(`Found ${emails.length} emails for interaction ${interactionId}`);
      return emails;
    } catch (error) {
      console.error(`Error fetching emails for interaction ${interactionId}:`, error);
      throw error;
    }
  },

  /**
   * Format emails as conversation similar to messages
   * @param {Array} emails - Array of email objects
   * @returns {Object} Formatted conversation object with transcription format
   */
  formatEmailsAsConversation(emails) {
    const conversation = {
      transcription: [], // Use transcription format to match messageService
      participants: new Set(),
      startTime: null,
      endTime: null,
      totalMessages: emails.length
    };

    emails.forEach(email => {
      // Determine sender role based on direction
      const isInbound = email.direction === 0;
      const senderRole = email.author?.role || (isInbound ? 'customer' : 'agent');
      const senderName = email.author?.name || email.from?.[0]?.name || (isInbound ? 'Customer' : 'Agent');
      const senderAddress = email.author?.id || email.from?.[0]?.address || '';
      
      // Add participants
      conversation.participants.add(senderName);
      
      // Track time range
      const emailTime = new Date(email.receivedAt || email.createdAt);
      if (!conversation.startTime || emailTime < conversation.startTime) {
        conversation.startTime = emailTime;
      }
      if (!conversation.endTime || emailTime > conversation.endTime) {
        conversation.endTime = emailTime;
      }
      
      // Format in the same structure as messageService
      // Each entry is an object with timestamp as key
      const timestamp = emailTime.getTime().toString();
      const transcriptionEntry = {
        [timestamp]: {
          speaker_id: senderAddress || senderName,
          speaker_role: senderRole,
          original_text: email.text || '',
          subject: email.subject, // Email-specific field
          timestamp: emailTime.toISOString(),
          attachments: email.attachments || [],
          forwarded: email.forward || false,
          direction: isInbound ? 'inbound' : 'outbound'
        }
      };
      
      conversation.transcription.push(transcriptionEntry);
    });
    
    // Sort transcription by timestamp
    conversation.transcription.sort((a, b) => {
      const timestampA = Object.keys(a)[0];
      const timestampB = Object.keys(b)[0];
      return parseInt(timestampA) - parseInt(timestampB);
    });
    
    return conversation;
  },

  /**
   * Determine speaker role from email
   * @param {Object} email - Email object
   * @returns {Object} Speaker information
   */
  determineSpeakerRole(email) {
    const isInbound = email.direction === 0;
    
    if (email.author && email.author.role) {
      return {
        name: email.author.name || (email.author.role === 'customer' ? 'Customer' : 'Agent'),
        email: email.author.id,
        role: email.author.role
      };
    }
    
    // Fallback logic based on direction
    return {
      name: email.from?.[0]?.name || (isInbound ? 'Customer' : 'Agent'),
      email: email.from?.[0]?.address || email.author?.id || '',
      role: isInbound ? 'customer' : 'agent'
    };
  },

  /**
   * Get conversation statistics from emails
   * @param {Array} emails - Array of email objects
   * @returns {Object} Conversation statistics matching messageService format
   */
  getConversationStats(emails) {
    const stats = {
      totalMessages: emails.length,
      customerMessages: 0,     // Match messageService naming
      agentMessages: 0,        // Match messageService naming
      multimediaMessages: 0,   // For attachments
      duration: 0,             // Match messageService naming
      averageResponseTime: 0,
      // Email-specific stats
      attachmentCount: 0,
      uniqueSubjects: new Set(),
      firstResponseTime: null,
      inboundMessages: 0,      // Keep for backward compatibility
      outboundMessages: 0      // Keep for backward compatibility
    };
    
    let firstInboundTime = null;
    let firstResponseTime = null;
    let lastEmailTime = null;
    let firstEmailTime = null;
    const responseTimes = [];
    
    emails.forEach((email, index) => {
      const emailTime = new Date(email.receivedAt || email.createdAt);
      
      if (index === 0) {
        firstEmailTime = emailTime;
      }
      lastEmailTime = emailTime;
      
      // Count directions
      if (email.direction === 0) {
        stats.customerMessages++;
        stats.inboundMessages++;
        if (!firstInboundTime) {
          firstInboundTime = emailTime;
        }
      } else {
        stats.agentMessages++;
        stats.outboundMessages++;
        if (!firstResponseTime && firstInboundTime) {
          firstResponseTime = emailTime;
          stats.firstResponseTime = Math.round((firstResponseTime - firstInboundTime) / 1000);
        }
        
        // Calculate response times
        if (index > 0 && emails[index - 1].direction === 0) {
          const prevEmailTime = new Date(emails[index - 1].receivedAt || emails[index - 1].createdAt);
          const responseTime = emailTime - prevEmailTime;
          responseTimes.push(responseTime);
        }
      }
      
      // Count attachments (similar to multimedia in messages)
      if (email.attachments && email.attachments.length > 0) {
        stats.multimediaMessages++; // Use same field name as messageService
        stats.attachmentCount += email.attachments.length;
      }
      
      // Track unique subjects
      if (email.subject) {
        stats.uniqueSubjects.add(email.subject);
      }
    });
    
    // Calculate average response time
    if (responseTimes.length > 0) {
      const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      stats.averageResponseTime = Math.round(avgResponseTime / 1000); // Convert to seconds
    }
    
    // Calculate conversation duration (use 'duration' to match messageService)
    if (firstEmailTime && lastEmailTime) {
      stats.duration = Math.round((lastEmailTime - firstEmailTime) / 1000); // Convert to seconds
      stats.conversationDuration = stats.duration; // Keep for backward compatibility
    }
    
    stats.uniqueSubjectCount = stats.uniqueSubjects.size;
    delete stats.uniqueSubjects; // Remove the Set object
    
    return stats;
  },

  /**
   * Count emails for multiple interactions (batch operation)
   * @param {Array} interactionIds - Array of interaction IDs
   * @returns {Object} Map of interactionId to email count
   */
  async countEmailsForInteractions(interactionIds) {
    try {
      console.log(`Counting emails for ${interactionIds.length} interactions`);
      
      const objectIds = interactionIds.map(id => new mongoose.Types.ObjectId(id));
      
      const emailCounts = await Email.aggregate([
        {
          $match: {
            interactionId: { $in: objectIds },
            isDeleted: { $ne: true }
          }
        },
        {
          $group: {
            _id: '$interactionId',
            emailCount: { $sum: 1 }
          }
        }
      ]);
      
      const countMap = emailCounts.reduce((map, item) => {
        map[item._id.toString()] = item.emailCount;
        return map;
      }, {});
      
      console.log(`Counted emails for ${emailCounts.length} interactions with emails`);
      
      return countMap;
    } catch (error) {
      console.error('Error counting emails for interactions:', error);
      return {};
    }
  },

  /**
   * Get email count for a single interaction
   * @param {string} interactionId - The interaction ID
   * @returns {number} Email count
   */
  async getEmailCountForInteraction(interactionId) {
    try {
      const objectId = new mongoose.Types.ObjectId(interactionId);
      
      const count = await Email.countDocuments({
        interactionId: objectId,
        isDeleted: { $ne: true }
      });
      
      return count;
    } catch (error) {
      console.error(`Error counting emails for interaction ${interactionId}:`, error);
      return 0;
    }
  }
};

module.exports = emailService;