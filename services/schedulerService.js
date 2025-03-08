// services/schedulerService.js
const cron = require('node-cron');
const { CriteriaProfile } = require('../config/mongodb');
const { Interactions } = require('../config/mongodb');
const { addEvaluationJob } = require('../services/queueService');
const mongoose = require('mongoose');

// Maintain active schedules
const activeSchedules = {};

/**
 * Initialize and start all active scheduled jobs from the database
 * @returns {Promise<void>}
 */
const initializeSchedules = async () => {
  try {
    console.log('Initializing scheduled evaluation jobs...');
    
    // Get all active criteria profiles with scheduling enabled
    const profiles = await CriteriaProfile.find({
      isActive: true,
      'scheduler.enabled': true
    });
    
    console.log(`Found ${profiles.length} active scheduled profiles`);
    
    // Start scheduler for each profile
    profiles.forEach(profile => {
      startScheduler(profile);
    });
  } catch (error) {
    console.error('Error initializing schedules:', error);
  }
};

/**
 * Start a scheduler for a criteria profile
 * @param {Object} profile - The criteria profile document
 * @returns {void}
 */
const startScheduler = (profile) => {
  try {
    // Skip if scheduler is not enabled
    if (!profile.scheduler || !profile.scheduler.enabled) {
      console.log(`Scheduler not enabled for profile: ${profile.name}`);
      return;
    }
    
    // Stop existing schedule if any
    stopScheduler(profile._id);
    
    const { cronExpression, maxEvaluations, evaluatorId, evaluatorName } = profile.scheduler;
    
    // Validate cron expression
    if (!cronExpression || !cron.validate(cronExpression)) {
      console.error(`Invalid cron expression for profile: ${profile.name}`);
      return;
    }
    
    console.log(`Starting scheduler for profile: ${profile.name} with cron: ${cronExpression}`);
    
    // Schedule the task
    const task = cron.schedule(cronExpression, async () => {
      console.log(`Running scheduled evaluation for profile: ${profile.name}`);
      await runScheduledEvaluation(profile, maxEvaluations, { id: evaluatorId, name: evaluatorName });
    });
    
    // Save to active schedules
    activeSchedules[profile._id] = task;
    
    console.log(`Scheduler started for profile: ${profile.name}`);
  } catch (error) {
    console.error(`Error starting scheduler for profile: ${profile.name}`, error);
  }
};

/**
 * Stop a scheduler for a profile
 * @param {string} profileId - The profile ID
 * @returns {void}
 */
const stopScheduler = (profileId) => {
  try {
    if (activeSchedules[profileId]) {
      activeSchedules[profileId].stop();
      delete activeSchedules[profileId];
      console.log(`Stopped scheduler for profile ID: ${profileId}`);
    }
  } catch (error) {
    console.error(`Error stopping scheduler for profile ID: ${profileId}`, error);
  }
};

/**
 * Run a scheduled evaluation for a profile
 * @param {Object} profile - The criteria profile
 * @param {number} maxEvaluations - Maximum number of evaluations to run
 * @param {Object} evaluator - Evaluator information
 * @returns {Promise<Object>} Results of the evaluation run
 */
const runScheduledEvaluation = async (profile, maxEvaluations = 50, evaluator = { id: 'system', name: 'Automated System' }) => {
  try {
    console.log(`Finding interactions for scheduled evaluation. Profile: ${profile.name}, Max: ${maxEvaluations}`);
    
    // Build search criteria from profile
    const searchCriteria = buildSearchCriteria(profile);
    
    // Find interactions matching criteria
    const interactions = await Interactions.find(searchCriteria)
      .sort({ createdAt: -1 })
      .limit(maxEvaluations)
      .lean();
    
    console.log(`Found ${interactions.length} interactions matching criteria`);
    
    if (interactions.length === 0) {
      return { 
        success: true, 
        profileId: profile._id, 
        message: 'No interactions found matching criteria', 
        interactionsFound: 0,
        interactionsProcessed: 0
      };
    }
    
    // Prepare evaluations
    const evaluations = interactions.map(interaction => ({
      interactionId: interaction._id,
      recordingUrl: interaction.extraPayload?.callRecording?.webPathQA,
      agent: {
        id: interaction.agent?.id,
        name: interaction.agent?.name
      },
      caller: {
        id: interaction.caller?.id
      },
      qaFormId: profile.evaluationForm.formId
    }));
    
    // Queue evaluations
    const jobResults = [];
    for (const evaluation of evaluations) {
      // Skip if no recording available
      if (!evaluation.recordingUrl) {
        console.log(`Skipping interaction ${evaluation.interactionId} due to missing recording`);
        continue;
      }
      
      // Add evaluation to queue
      const jobId = await addEvaluationJob(
        { ...evaluation, evaluator },
        { priority: 5 } // Give scheduled jobs a slightly lower priority
      );
      
      jobResults.push({
        interactionId: evaluation.interactionId,
        jobId: jobId,
        status: 'queued'
      });
    }
    
    console.log(`Queued ${jobResults.length} evaluations for profile: ${profile.name}`);
    
    // Return results
    return { 
      success: true, 
      profileId: profile._id, 
      interactionsFound: interactions.length,
      interactionsProcessed: jobResults.length,
      jobs: jobResults
    };
  } catch (error) {
    console.error(`Error running scheduled evaluation for profile: ${profile.name}`, error);
    return { 
      success: false, 
      profileId: profile._id, 
      error: error.message 
    };
  }
};

/**
 * Build MongoDB search criteria from profile
 * @param {Object} profile - The criteria profile
 * @returns {Object} MongoDB query object
 */
const buildSearchCriteria = (profile) => {
  const query = {};
  
  // Filter by direction
  if (profile.direction && profile.direction !== 'all') {
    query.direction = profile.direction === 'inbound' ? 0 : 1;
  }
  
  // Filter by agent IDs
  if (profile.agents && profile.agents.length > 0) {
    query['agent.id'] = { 
      $in: profile.agents.map(agent => {
        // Try to convert to number if it's stored as string
        const agentId = agent.agentId || agent.id;
        return isNaN(agentId) ? agentId : parseInt(agentId);
      })
    };
  }
  
  // Filter by queues
  if (profile.queues && profile.queues.length > 0) {
    // Check if queue identifiers are numeric IDs or string names
    const queuesData = profile.queues.map(queue => ({
      id: queue.queueId || queue.id,
      name: queue.queueName || queue.name
    }));
    
    // Separate numeric IDs and string names
    const numericIds = [];
    const queueNames = [];
    
    queuesData.forEach(queue => {
      if (!isNaN(queue.id)) {
        numericIds.push(parseInt(queue.id));
      }
      
      // If there's a queue name, add it to the names array
      if (queue.name && typeof queue.name === 'string') {
        queueNames.push(queue.name);
      }
    });
    
    // Build the query for both ID and name
    if (numericIds.length > 0 && queueNames.length > 0) {
      // If we have both, use $or to match either
      query.$or = [
        { 'queue.id': { $in: numericIds } },
        { 'queue.name': { $in: queueNames } }
      ];
    } else if (numericIds.length > 0) {
      // If we only have numeric IDs
      query['queue.id'] = { $in: numericIds };
    } else if (queueNames.length > 0) {
      // If we only have string names
      query['queue.name'] = { $in: queueNames };
    }
  }
  
  // Filter by work codes
  if (profile.workCodes && profile.workCodes.length > 0) {
    query['workCode.code'] = { 
      $in: profile.workCodes.map(workCode => workCode.code || workCode) 
    };
  }
  
  // Filter by min call duration
  if (profile.minCallDuration > 0) {
    query['connect.duration'] = { $gte: profile.minCallDuration };
  }
  
  // Make sure call has recording
  query['extraPayload.callRecording.webPathQA'] = { $exists: true, $ne: null };
  
  // Exclude already evaluated interactions
  query['extraPayload.evaluated'] = { $ne: true };
  
  // Add date filter - default to last 24 hours
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  
  query.createdAt = { $gte: oneDayAgo };
  
  return query;
};

/**
 * Manually run a scheduled evaluation
 * @param {string} profileId - The profile ID
 * @param {number} maxEvaluations - Maximum evaluations to run
 * @param {Object} evaluator - Evaluator information
 * @returns {Promise<Object>} Results of the evaluation run
 */
const manualRunScheduledEvaluation = async (profileId, maxEvaluations, evaluator) => {
  try {
    // Find the profile
    const profile = await CriteriaProfile.findById(profileId);
    
    if (!profile) {
      throw new Error('Profile not found');
    }
    
    // Run evaluation
    return await runScheduledEvaluation(
      profile, 
      maxEvaluations || profile.scheduler?.maxEvaluations || 50,
      evaluator || { id: 'manual', name: 'Manual Run' }
    );
  } catch (error) {
    console.error('Error manually running scheduled evaluation:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update a profile's scheduler
 * @param {string} profileId - The profile ID
 * @param {Object} schedulerConfig - New scheduler configuration
 * @returns {Promise<Object>} Updated profile or error
 */
const updateScheduler = async (profileId, schedulerConfig) => {
  try {
    // Validate cron expression if provided
    if (schedulerConfig.cronExpression && !cron.validate(schedulerConfig.cronExpression)) {
      throw new Error('Invalid cron expression');
    }
    
    // Update profile
    const updatedProfile = await CriteriaProfile.findByIdAndUpdate(
      profileId,
      { $set: { scheduler: schedulerConfig } },
      { new: true }
    );
    
    if (!updatedProfile) {
      throw new Error('Profile not found');
    }
    
    // Start or stop scheduler based on enabled status
    if (schedulerConfig.enabled) {
      startScheduler(updatedProfile);
    } else {
      stopScheduler(profileId);
    }
    
    return { success: true, profile: updatedProfile };
  } catch (error) {
    console.error('Error updating scheduler:', error);
    return { success: false, error: error.message };
  }
};

// Export all functions for use in other modules
module.exports = {
  initializeSchedules,
  startScheduler,
  stopScheduler,
  updateScheduler,
  manualRunScheduledEvaluation,
  runScheduledEvaluation,
  getActiveSchedules: () => Object.keys(activeSchedules)
};