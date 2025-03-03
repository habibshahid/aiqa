// routes/qaProcess.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { evaluationQueue, addEvaluationJob } = require('../services/queueService');
const { InteractionAIQA } = require('../config/mongodb');

router.use(authenticateToken);

// Process multiple evaluations
router.post('/process-evaluations', async (req, res) => {
  try {
    const { evaluations, evaluator } = req.body;
    
    if (!evaluations || !Array.isArray(evaluations) || evaluations.length === 0) {
      return res.status(400).json({ message: 'No evaluations provided' });
    }
    
    console.log(`Queueing ${evaluations.length} evaluations for processing`);

    if (!evaluator || !evaluator.id || !evaluator.name) {
      // Extract evaluator info from the authenticated user
      evaluator = {
        id: req.user.id,
        name: req.user.username || req.user.first_name || 'Unknown'
      };
    }
    
    const jobResults = [];
    for (const evaluation of evaluations) {
      evaluation.evaluator = evaluator;
      
      // Add to queue with priority based on some criteria (optional)
      const priority = evaluation.priority || 0; 
      const jobId = await addEvaluationJob(evaluation, { priority });
      
      jobResults.push({
        interactionId: evaluation.interactionId,
        jobId: jobId,
        status: 'queued'
      });
    }

    res.json({
      message: `Queued ${evaluations.length} evaluations for processing`,
      jobs: jobResults
    });
  } catch (error) {
    console.error('Error processing evaluations:', error);
    res.status(500).json({ message: 'Error processing evaluations', error: error.message });
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

module.exports = router;