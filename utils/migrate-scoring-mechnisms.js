// scripts/migrate-scoring-mechanism.js
require('dotenv').config();
const mongoose = require('mongoose');
const { QAForm } = require('../config/mongodb');
const { InteractionAIQA } = require('../config/mongodb');

async function migrateEvaluationScoring() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB');
    
    // Find all evaluations without scoring mechanism
    const evaluations = await InteractionAIQA.find({ 
      scoringMechanism: { $exists: false } 
    });
    
    console.log(`Found ${evaluations.length} evaluations to migrate`);
    
    // Batch update for better performance
    const bulkOps = evaluations.map(evaluation => ({
      updateOne: {
        filter: { _id: evaluation._id },
        update: { 
          $set: { 
            scoringMechanism: 'award',
            formTotalScore: evaluation.evaluationData?.evaluation?.maxScore || 100,
            'sectionScores.overall.scoringMechanism': 'award'
          } 
        }
      }
    }));
    
    if (bulkOps.length > 0) {
      const result = await InteractionAIQA.bulkWrite(bulkOps);
      console.log(`Updated ${result.modifiedCount} evaluations`);
    }
    
    console.log('Migration completed successfully');
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

migrateEvaluationScoring();