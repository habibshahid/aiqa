// services/queueService.js
const Queue = require('bull');
const { processEvaluation } = require('./qaProcessor');

// Create a new Bull queue with Redis connection
const evaluationQueue = new Queue('evaluation-processing', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    database: process.env.REDIS_DB || 3,
  },
  limiter: {
    max: 5, // Maximum number of jobs processed concurrently
    duration: 5000 // Time window in milliseconds
  }
});

// Process queue items
evaluationQueue.process(async (job) => {
  console.log(`Processing evaluation job ${job.id} for interaction ${job.data.interactionId}`);
  
  try {
    const result = await processEvaluation(job.data);
    return result;
  } catch (error) {
    console.error(`Error processing job ${job.id}:`, error);
    throw error; // This will mark the job as failed
  }
});

// Add event handlers
evaluationQueue.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed with result:`, result);
});

evaluationQueue.on('failed', (job, error) => {
  console.error(`Job ${job.id} failed with error:`, error);
});

module.exports = {
  evaluationQueue,
  
  // Helper to add a job to the queue
  addEvaluationJob: async (evaluationData, options = {}) => {
    const job = await evaluationQueue.add(evaluationData, {
      priority: options.priority || 0,
      attempts: options.attempts || 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      },
      removeOnComplete: true,
      removeOnFail: false, // Keep failed jobs for debugging
      ...options
    });
    
    return job.id;
  }
};