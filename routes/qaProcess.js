// routes/qaProcess.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { evaluationQueue, addEvaluationJob } = require('../services/queueService');
const { InteractionAIQA } = require('../config/mongodb');
const TEXT_CHANNELS = ['whatsapp', 'fb_messenger', 'facebook', 'instagram_dm', 'chat', 'email', 'sms'];
const emailService = require('../services/emailService');

router.use(authenticateToken);

function validateEvaluationData(evaluation, interaction) {
  const errors = [];
  
  // Basic required fields
  if (!evaluation.interactionId) {
    errors.push('interactionId is required');
  }
  
  if (!evaluation.qaFormId) {
    errors.push('qaFormId is required');
  }
  
  // Channel-specific validation
  const channel = interaction?.channel || 'call';
  const isTextChannel = TEXT_CHANNELS.includes(channel);
  
  if (isTextChannel) {
    // For text channels, we don't need recording URL
    console.log(`Text channel (${channel}) detected - skipping recording URL validation`);
  } else {
    // For audio channels, recording URL is required
    if (!evaluation.recordingUrl) {
      errors.push(`recordingUrl is required for audio channel: ${channel}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    isTextChannel,
    channel
  };
}

// Process multiple evaluations
router.post('/process-evaluations', authenticateToken, async (req, res) => {
  try {
    const { evaluations, evaluator } = req.body;
    
    if (!evaluations || !Array.isArray(evaluations) || evaluations.length === 0) {
      return res.status(400).json({ 
        message: 'Evaluations array is required and must not be empty' 
      });
    }

    console.log(`\n=== Processing ${evaluations.length} evaluations ===`);
    
    const jobs = [];
    const validationErrors = [];
    
    // Enhanced validation with channel detection
    for (let i = 0; i < evaluations.length; i++) {
      const evaluation = evaluations[i];
      
      // Get interaction details for validation
      let interaction = null;
      try {
        const { Interactions } = require('../config/mongodb');
        interaction = await Interactions.findById(evaluation.interactionId).lean();
      } catch (error) {
        console.warn(`Could not fetch interaction ${evaluation.interactionId}:`, error.message);
      }
      
      const validation = validateEvaluationData(evaluation, interaction);
      
      if (!validation.isValid) {
        validationErrors.push({
          index: i,
          interactionId: evaluation.interactionId,
          errors: validation.errors,
          channel: validation.channel
        });
        continue;
      }
      
      // Enhanced evaluation data with channel info
      const enhancedEvaluation = {
        ...evaluation,
        evaluator: evaluator || { id: 'system', name: 'AI System' },
        channel: validation.channel,
        isTextChannel: validation.isTextChannel,
        processingType: validation.isTextChannel ? 'text' : 'audio'
      };
      
      // Add to queue with appropriate priority
      // Text channels might process faster, so give them higher priority
      const priority = validation.isTextChannel ? 2 : 1;
      
      const job = await evaluationQueue.add(enhancedEvaluation, {
        priority,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 50,
        removeOnFail: 10,
      });
      
      jobs.push({
        jobId: job.id,
        interactionId: evaluation.interactionId,
        channel: validation.channel,
        processingType: validation.isTextChannel ? 'text' : 'audio'
      });
      
      console.log(`Queued ${validation.isTextChannel ? 'text' : 'audio'} evaluation: ${evaluation.interactionId} (${validation.channel})`);
    }

    router.get('/processing-stats', authenticateToken, async (req, res) => {
      try {
        const { InteractionAIQA } = require('../config/mongodb');
        
        // Get evaluation statistics by processing type and channel
        const stats = await InteractionAIQA.aggregate([
          {
            $group: {
              _id: {
                processingType: '$processingType',
                channel: '$interactionData.channel',
                status: '$status'
              },
              count: { $sum: 1 },
              avgScore: { $avg: '$evaluationData.evaluation.totalScore' },
              maxScore: { $avg: '$evaluationData.evaluation.maxScore' }
            }
          },
          {
            $group: {
              _id: {
                processingType: '$_id.processingType',
                channel: '$_id.channel'
              },
              statusBreakdown: {
                $push: {
                  status: '$_id.status',
                  count: '$count',
                  avgScore: '$avgScore',
                  maxScore: '$maxScore'
                }
              },
              totalEvaluations: { $sum: '$count' }
            }
          },
          {
            $sort: { '_id.channel': 1 }
          }
        ]);
        
        // Format the response
        const formattedStats = {
          byChannel: {},
          summary: {
            totalEvaluations: 0,
            audioEvaluations: 0,
            textEvaluations: 0
          }
        };
        
        stats.forEach(stat => {
          const channel = stat._id.channel || 'unknown';
          const processingType = stat._id.processingType || 'audio';
          
          if (!formattedStats.byChannel[channel]) {
            formattedStats.byChannel[channel] = {
              channel,
              processingType,
              totalEvaluations: 0,
              statusBreakdown: {}
            };
          }
          
          formattedStats.byChannel[channel].totalEvaluations += stat.totalEvaluations;
          
          stat.statusBreakdown.forEach(status => {
            formattedStats.byChannel[channel].statusBreakdown[status.status] = {
              count: status.count,
              avgScore: Math.round(status.avgScore || 0),
              maxScore: Math.round(status.maxScore || 0),
              percentage: status.maxScore > 0 ? Math.round((status.avgScore / status.maxScore) * 100) : 0
            };
          });
          
          // Update summary
          formattedStats.summary.totalEvaluations += stat.totalEvaluations;
          if (processingType === 'text') {
            formattedStats.summary.textEvaluations += stat.totalEvaluations;
          } else {
            formattedStats.summary.audioEvaluations += stat.totalEvaluations;
          }
        });
        
        res.json(formattedStats);
        
      } catch (error) {
        console.error('Error fetching processing stats:', error);
        res.status(500).json({ 
          message: 'Error fetching processing stats', 
          error: error.message 
        });
      }
    });

    // Return results with enhanced information
    const response = {
      message: `Queued ${jobs.length} evaluations for processing`,
      processed: jobs.length,
      failed: validationErrors.length,
      jobs: jobs.map(job => ({
        jobId: job.jobId,
        interactionId: job.interactionId,
        channel: job.channel,
        processingType: job.processingType
      })),
      summary: {
        total: evaluations.length,
        queued: jobs.length,
        audioChannels: jobs.filter(j => j.processingType === 'audio').length,
        textChannels: jobs.filter(j => j.processingType === 'text').length,
        failed: validationErrors.length
      }
    };
    
    if (validationErrors.length > 0) {
      response.validationErrors = validationErrors;
      console.log(`Validation errors for ${validationErrors.length} evaluations:`, validationErrors);
    }
    
    console.log(`=== Successfully queued ${jobs.length}/${evaluations.length} evaluations ===`);
    console.log(`Audio channels: ${response.summary.audioChannels}, Text channels: ${response.summary.textChannels}`);
    
    res.json(response);
    
  } catch (error) {
    console.error('Error processing evaluations:', error);
    res.status(500).json({ 
      message: 'Error processing evaluations', 
      error: error.message 
    });
  }
});

router.post('/process-single', authenticateToken, async (req, res) => {
  try {
    const evaluation = req.body;
    
    // Get interaction details for validation
    let interaction = null;
    try {
      const { Interactions } = require('../config/mongodb');
      interaction = await Interactions.findById(evaluation.interactionId).lean();
    } catch (error) {
      console.warn(`Could not fetch interaction ${evaluation.interactionId}:`, error.message);
    }
    
    const validation = validateEvaluationData(evaluation, interaction);
    
    if (!validation.isValid) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: validation.errors,
        channel: validation.channel
      });
    }
    
    // Enhanced evaluation data
    const enhancedEvaluation = {
      ...evaluation,
      evaluator: evaluation.evaluator || { id: req.user.id, name: req.user.username },
      channel: validation.channel,
      isTextChannel: validation.isTextChannel,
      processingType: validation.isTextChannel ? 'text' : 'audio'
    };
    
    // Process immediately for single evaluation
    const qaProcessor = require('../services/qaProcessor');
    const result = await qaProcessor.processEvaluation(enhancedEvaluation);
    
    if (result.success) {
      res.json({
        success: true,
        message: `Successfully processed ${validation.isTextChannel ? 'text' : 'audio'} evaluation`,
        evaluationId: result.evaluationId,
        interactionId: result.interactionId,
        channel: validation.channel,
        processingType: result.processingType
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Processing failed',
        error: result.error,
        interactionId: result.interactionId,
        channel: validation.channel
      });
    }
    
  } catch (error) {
    console.error('Error processing single evaluation:', error);
    res.status(500).json({ 
      message: 'Error processing evaluation', 
      error: error.message 
    });
  }
});

// Add a route to check job status
router.get('/job-status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Get job from queue
    const job = await evaluationQueue.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    // Get job state
    const state = await job.getState();
    
    res.json({
      jobId: job.id,
      state,
      progress: job.progress,
      data: job.data,
      result: job.returnvalue,
      error: job.failedReason
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching job status', error: error.message });
  }
});

// In routes/qaProcess.js

// Get queue status
router.get('/queue-status', authenticateToken, async (req, res) => {
  try {
    const { evaluationQueue } = require('../services/queueService');
    
    // Get queue stats
    const stats = await evaluationQueue.getJobCounts();
    
    // Get jobs - combine all types
    const [waiting, active, completed, failed] = await Promise.all([
      evaluationQueue.getJobs(['waiting'], 0, 100),
      evaluationQueue.getJobs(['active'], 0, 100),
      evaluationQueue.getJobs(['completed'], 0, 100),
      evaluationQueue.getJobs(['failed'], 0, 100)
    ]);
    
    // Combine and sort by timestamp (newest first)
    const jobs = [...waiting, ...active, ...completed, ...failed]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 100) // Limit to most recent 100
      .map(job => ({
        id: job.id,
        data: job.data,
        state: job.finishedOn ? (job.failedReason ? 'failed' : 'completed') : (job.processedOn ? 'active' : 'waiting'),
        progress: job.progress,
        timestamp: job.timestamp,
        result: job.returnvalue,
        failedReason: job.failedReason
      }));
    
    res.json({
      stats: {
        waiting: stats.waiting,
        active: stats.active,
        completed: stats.completed,
        failed: stats.failed,
        total: stats.waiting + stats.active + stats.completed + stats.failed
      },
      jobs
    });
  } catch (error) {
    console.error('Error fetching queue status:', error);
    res.status(500).json({ message: 'Error fetching queue status', error: error.message });
  }
});

router.get('/queue-count', authenticateToken, async (req, res) => {
  try {
    const { evaluationQueue } = require('../services/queueService');
    
    // Get active and waiting job counts
    const counts = await evaluationQueue.getJobCounts();
    const count = counts.waiting + counts.active;
    
    res.json({ count });
  } catch (error) {
    console.error('Error fetching queue count:', error);
    res.status(500).json({ message: 'Error fetching queue count', error: error.message });
  }
});

router.post('/search-interactions', async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      queues,
      agents,
      minDuration,
      maxDuration,
      workCodes,
      direction,
      excludeEvaluated = true,
      channel // NEW: Add channel filter
    } = req.body;

    // Build query
    let query = {
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };

    // Add filters
    if (queues && queues.length > 0) {
      query['queue.name'] = { $in: queues };
    }

    if (agents && agents.length > 0) {
      query['agent.id'] = { $in: agents.map(id => parseInt(id)) };
    }

    if (direction !== undefined && direction !== 'all') {
      query.direction = direction === 'inbound' ? 0 : 1;
    }

    // UPDATED: Channel filter
    if (channel && channel !== 'all') {
      if (channel === 'voice') {
        // Voice channels (calls)
        query.$or = [
          { channel: { $exists: false } },
          { channel: 'call' },
          { channel: { $in: ['sip', 'phone', 'voice'] } }
        ];
      } else if (channel === 'text') {
        // All text channels
        query.channel = { $in: ['whatsapp', 'fb_messenger', 'facebook', 'instagram_dm', 'email'] };
      } else {
        // Specific channel
        query.channel = channel;
      }
    }

    // UPDATED: Duration filter - only for voice channels
    if (minDuration || maxDuration) {
      // Check if we're filtering for voice channels
      const isVoiceQuery = !query.channel || 
                          query.channel === 'call' || 
                          (query.$or && query.$or.length > 0);
      
      if (isVoiceQuery) {
        query['connect.duration'] = {};
        if (minDuration) query['connect.duration'].$gte = parseInt(minDuration);
        if (maxDuration) query['connect.duration'].$lte = parseInt(maxDuration);
      }
    }

    // Exclude already evaluated interactions
    if (excludeEvaluated) {
      query['extraPayload.evaluated'] = { $ne: true };
    }

    // Fetch interactions
    let interactions = await Interactions.find(query)
      .select('_id createdAt agent caller queue connect channel extraPayload direction')
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();

    // UPDATED: For text channels, add message count
    const textChannels = ['whatsapp', 'fb_messenger', 'facebook', 'instagram_dm'];
    const emailChannel = 'email';

    for (let interaction of interactions) {
      console.log('$$$$$$$$$$$$$$$$$$$$$$$$$$$$$', interaction)
      if (textChannels.includes(interaction.channel)) {
        // Count messages for text-based interactions
        const messageCount = await mongoose.connection.collection('messages').countDocuments({
          interactionId: interaction._id,
          isDeleted: { $ne: true }
        });
        
        interaction.messageCount = messageCount;
        interaction.hasContent = messageCount > 0;
        
        // For text channels, we need at least one message
        if (messageCount === 0) {
          interaction.canEvaluate = false;
          interaction.evaluationStatus = 'No messages found';
        } else {
          interaction.canEvaluate = true;
        }
      } else if (interaction.channel === emailChannel) {
        // Count emails for email interactions
        const emailCount = await mongoose.connection.collection('emails').countDocuments({
          interactionId: interaction._id,
          isDeleted: { $ne: true }
        });
        
        interaction.messageCount = emailCount;
        interaction.hasContent = emailCount > 0;
        
        if (emailCount === 0) {
          interaction.canEvaluate = false;
          interaction.evaluationStatus = 'No emails found';
        } else {
          interaction.canEvaluate = true;
        }
      } else {
        // Voice channel - check for recording
        const hasRecording = interaction.extraPayload?.callRecording?.webPath || 
                           interaction.extraPayload?.callRecording?.webPathQA;
        
        interaction.canEvaluate = hasRecording;
        interaction.evaluationStatus = hasRecording ? 'Ready' : 'No recording';
      }
    }

    // Filter out interactions that can't be evaluated
    interactions = interactions.filter(i => i.canEvaluate);

    res.json({
      success: true,
      count: interactions.length,
      interactions
    });

  } catch (error) {
    console.error('Error searching interactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching interactions',
      error: error.message
    });
  }
});

// UPDATED: Add endpoint to get message preview for text interactions
router.get('/interaction/:id/messages-preview', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 5 } = req.query;
    
    // Fetch first few messages
    const messages = await mongoose.connection.collection('messages')
      .find({ 
        interactionId: mongoose.Types.ObjectId(id),
        isDeleted: { $ne: true },
        message: { $exists: true, $ne: '' }
      })
      .sort({ createdAt: 1 })
      .limit(parseInt(limit))
      .toArray();
    
    const preview = messages.map(msg => ({
      author: msg.author.name || msg.author.id,
      role: msg.author.role,
      message: msg.message,
      timestamp: msg.createdAt,
      type: msg.messageType
    }));
    
    res.json({
      success: true,
      preview,
      totalMessages: messages.length
    });
    
  } catch (error) {
    console.error('Error fetching message preview:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching message preview',
      error: error.message
    });
  }
});

module.exports = router;