// routes/scheduler.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const schedulerService = require('../services/schedulerService');
const { CriteriaProfile, SchedulerHistory } = require('../config/mongodb');
const cron = require('node-cron');

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * Get scheduler settings for a criteria profile
 */
router.get('/profile/:profileId', async (req, res) => {
  try {
    const { profileId } = req.params;
    
    // Find profile
    const profile = await CriteriaProfile.findById(profileId);
    
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    
    // Return scheduler settings
    res.json({ 
      scheduler: profile.scheduler || {},
      profileName: profile.name,
      isActive: profile.isActive
    });
  } catch (error) {
    console.error('Error getting scheduler settings:', error);
    res.status(500).json({ message: 'Error fetching scheduler settings', error: error.message });
  }
});

/**
 * Update scheduler settings for a criteria profile
 */
router.put('/profile/:profileId', async (req, res) => {
  try {
    const { profileId } = req.params;
    const schedulerConfig = req.body;
    
    // Validate cron expression
    if (schedulerConfig.cronExpression && !cron.validate(schedulerConfig.cronExpression)) {
      return res.status(400).json({ message: 'Invalid cron expression' });
    }
    
    // Update scheduler
    const result = await schedulerService.updateScheduler(profileId, schedulerConfig);
    
    if (!result.success) {
      return res.status(400).json({ message: result.error });
    }
    
    res.json({ 
      message: 'Scheduler updated successfully', 
      scheduler: result.profile.scheduler
    });
  } catch (error) {
    console.error('Error updating scheduler settings:', error);
    res.status(500).json({ message: 'Error updating scheduler settings', error: error.message });
  }
});

/**
 * Run a scheduled evaluation manually
 */
router.post('/run/:profileId', async (req, res) => {
  try {
    const { profileId } = req.params;
    const { maxEvaluations } = req.body;
    
    // Create evaluator info from current user
    const evaluator = {
      id: req.user.id,
      name: req.user.username || req.user.first_name || 'Manual Run'
    };
    
    // Run evaluation
    const result = await schedulerService.manualRunScheduledEvaluation(
      profileId, 
      maxEvaluations, 
      evaluator
    );
    
    if (!result.success) {
      return res.status(400).json({ message: result.error });
    }
    
    // Save to history
    await SchedulerHistory.create({
      profileId,
      profileName: result.profileName,
      startTime: new Date(),
      endTime: new Date(),
      status: result.interactionsProcessed > 0 ? 
        (result.interactionsProcessed === result.interactionsFound ? 'success' : 'partial') : 
        'failed',
      interactionsFound: result.interactionsFound || 0,
      interactionsProcessed: result.interactionsProcessed || 0,
      jobIds: result.jobs?.map(job => job.jobId) || [],
      error: result.error
    });
    
    res.json({ 
      message: 'Scheduled evaluation started successfully', 
      result
    });
  } catch (error) {
    console.error('Error running scheduled evaluation:', error);
    res.status(500).json({ message: 'Error running scheduled evaluation', error: error.message });
  }
});

/**
 * Get scheduler history for a profile
 */
router.get('/history/:profileId', async (req, res) => {
  try {
    const { profileId } = req.params;
    const { limit = 10 } = req.query;
    
    // Get history
    const history = await SchedulerHistory.find({ profileId })
      .sort({ startTime: -1 })
      .limit(parseInt(limit))
      .lean();
    
    res.json(history);
  } catch (error) {
    console.error('Error getting scheduler history:', error);
    res.status(500).json({ message: 'Error fetching scheduler history', error: error.message });
  }
});

/**
 * Get all active scheduled profiles
 */
router.get('/active', async (req, res) => {
  try {
    // Get all active profiles with scheduling enabled
    const profiles = await CriteriaProfile.find({
      isActive: true,
      'scheduler.enabled': true
    })
    .select('name scheduler evaluationForm')
    .sort({ name: 1 })
    .lean();
    
    // Get currently active schedules from the service
    const activeSchedules = schedulerService.getActiveSchedules();
    
    // Add active status to each profile
    const profilesWithStatus = profiles.map(profile => ({
      ...profile,
      isRunning: activeSchedules.includes(profile._id.toString())
    }));
    
    res.json(profilesWithStatus);
  } catch (error) {
    console.error('Error getting active schedules:', error);
    res.status(500).json({ message: 'Error fetching active schedules', error: error.message });
  }
});

module.exports = router;