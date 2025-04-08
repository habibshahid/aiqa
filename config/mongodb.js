// config/mongodb.js
const mongoose = require('mongoose');
const QAFormSchema = require('../models/QAForm');

const connectMongoDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('\n=== MongoDB Connection Status ===');
    console.log('Status:', mongoose.connection.readyState === 1 ? 'Connected' : 'Not Connected');
    console.log('Database:', mongoose.connection.name);
    console.log('Host:', mongoose.connection.host);
    console.log('==============================\n');
    return true;
  } catch (error) {
    console.error('\n=== MongoDB Connection Error ===');
    console.error('Error:', error.message);
    console.error('==============================\n');
    return false;
  }
};

// Schema for Usage Stats
const usageDetailsSchema = new mongoose.Schema({
  completion_tokens_details: {
    rejected_prediction_tokens: Number,
    accepted_prediction_tokens: Number,
    audio_tokens: Number,
    reasoning_tokens: Number
  },
  prompt_tokens_details: {
    audio_tokens: Number,
    cached_tokens: Number
  },
  total_tokens: Number,
  completion_tokens: Number,
  prompt_tokens: Number
});

// Updated InteractionAIQA schema in mongodb.js
const evaluationCriteriaSchema = new mongoose.Schema({
  explanation: String,
  confidence: String,
  score: Number,
  classification: {
    type: String,
    enum: ['none', 'minor', 'moderate', 'major'],
    default: 'none'
  }
});


const silencePeriodSchema = new mongoose.Schema({
  fromTimeStamp: String,
  toTimeStamp: String,
  silenceDuration: Number
});

const evaluationSchema = new mongoose.Schema({
  parameters: {
    type: Map,
    of: evaluationCriteriaSchema
  },
  silencePeriods: [silencePeriodSchema],
  summary: String,
  intent: [String],
  areasOfImprovements: [String],
  whatTheAgentDidWell: [String], 
  totalScore: Number,
  maxScore: Number,
  customerSentiment: [String],
  agentSentiment: [String],
  problemAreas: [String]
});

// Message Content Schema for Transcription
const messageContentSchema = new mongoose.Schema({
  port: Number,
  usage: usageDetailsSchema,
  language: String,
  intent: [String],
  profanity: {
    words: [String],
    score: Number
  },
  sentiment: {
    sentiment: String,
    score: Number
  },
  translated_text: String,
  original_text: String,
  speaker_id: String
});

// New schema for recorded transcriptions
const recordedTranscriptionEntrySchema = new mongoose.Schema({
  timestamp: String,
  channel: Number,
  speaker_id: String,
  original_text: String,
  translated_text: String,
  language: String,
  sentiment: {
    sentiment: String,
    score: Number
  },
  intent: [String]
});

// Transcription Schema with version support
const transcriptionSchema = new mongoose.Schema({
  interactionId: { type: String, required: true },
  transcriptionVersion: { 
    type: String, 
    enum: ['realtime', 'recorded'],
    default: 'realtime'
  },
  // Original format (map-based)
  transcription: {
    type: Array,
    required: function() { return this.transcriptionVersion === 'realtime'; }
  },
  // New format (array of structured objects)
  recordedTranscription: {
    type: [recordedTranscriptionEntrySchema],
    required: function() { return this.transcriptionVersion === 'recorded'; }
  }
}, { 
  collection: 'interactiontranscriptions',
  timestamps: true 
});

const humanEvaluationSchema = new mongoose.Schema({
  // Parameter evaluations with human scores, explanations, and classifications
  parameters: {
    type: Map,
    of: new mongoose.Schema({
      score: Number,  // Original AI score
      explanation: String, // Original AI explanation
      humanScore: Number, // Human score
      humanExplanation: String, // Human explanation
      classification: {
        type: String,
        enum: ['none', 'minor', 'moderate', 'major'],
        default: null
      } // Human-assigned classification
    }, { _id: false, strict: false })
  },
  
  // Additional comments from QA evaluator
  additionalComments: {
    type: String,
    default: ''
  },
  
  // Comments from the agent (response to the evaluation)
  agentComments: {
    type: String,
    default: ''
  },
  
  // Moderation status
  isModerated: {
    type: Boolean,
    default: false
  },
  
  // Publication status (visible to agent)
  isPublished: {
    type: Boolean,
    default: false
  },
  
  // Who moderated the evaluation
  moderatedByUserId: {
    type: Number,
    default: null
  },

  moderatedBy: {
    type: String,
    default: null
  },
  
  // When the evaluation was moderated
  moderatedAt: {
    type: Date,
    default: null
  }
}, { _id: false, strict: false });

// Add this to the interactionAIQASchema in config/mongodb.js
const sectionScoresSchema = new mongoose.Schema({
  sections: {
    type: Map,
    of: new mongoose.Schema({
      name: String,
      rawScore: Number,
      maxScore: Number,
      adjustedScore: Number,
      percentage: Number,
      parameters: [
        new mongoose.Schema({
          name: String,
          score: Number,
          maxScore: Number,
          classification: String
        }, { _id: false, strict: false })
      ],
      classifications: {
        minor: Boolean,
        moderate: Boolean,
        major: Boolean
      },
      highestClassification: String,
      highestClassificationImpact: Number
    }, { _id: false, strict: false })
  },
  overall: {
    rawScore: Number,
    adjustedScore: Number,
    maxScore: Number,
    percentage: Number
  }
}, { _id: false, strict: false });

const interactionAIQASchema = new mongoose.Schema({
  interactionId: { type: String, required: true },
  qaFormName: { type: String, required: true },
  qaFormId: { type: String, required: true },
  evaluator: {     // Add this new field
    id: String,
    name: String
  },
  sectionScores: {
    type: sectionScoresSchema,
    default: null
  },
  evaluationData: {
    usage: usageDetailsSchema,
    evaluation: evaluationSchema
  },
  interactionData: {
    queue: {
      name: String
    },
    agent: {
      id: String,
      name: String
    },
    caller: {
      id: String
    },
    direction: String,
    duration: Number,
    channel: String
  }
  ,status: {
    type: String,
    enum: ['pending', 'completed', 'moderated', 'published'],
    default: 'pending'
  },
  
  // Human evaluation data
  humanEvaluation: {
    type: humanEvaluationSchema,
    default: null
  }
}, { 
  collection: 'interactionaiqas',
  timestamps: true 
});

// Interactions Schema
const Interactions = require('../models/interaction');

// Fixed version of the pre-save hook that properly handles null values
// Enhanced pre-save hook that ensures totalScore and maxScore are properly saved
/*interactionAIQASchema.pre('save', async function(next) {
  try {
    // If this is a newly moderated evaluation or scores have changed
    if (this.isModified('humanEvaluation') || this.isModified('evaluationData.evaluation') || !this.evaluationData?.evaluation?.totalScore) {
      console.log('Human evaluation or evaluation data modified, recalculating scores');
      
      // Skip calculation if no QA form ID
      if (!this.qaFormId) {
        console.log('No QA form ID, skipping score calculation');
        return next();
      }
      
      // Calculate scores manually first as a fallback
      let rawScore = 0;
      let maxScore = 0;
      
      // Safe access to parameters - either from human evaluation or AI evaluation
      let parameters = {};
      
      // Safely check humanEvaluation parameters
      if (this.humanEvaluation && this.humanEvaluation.parameters) {
        parameters = this.humanEvaluation.parameters;
      } 
      // Fallback to AI evaluation parameters
      else if (this.evaluationData && this.evaluationData.evaluation && this.evaluationData.evaluation.parameters) {
        parameters = this.evaluationData.evaluation.parameters;
      }
      
      // Calculate from parameters - with safer checking for null values
      if (parameters) {
        // Handle both Map objects and plain objects
        const paramEntries = parameters instanceof Map ? 
          Array.from(parameters.entries()) : 
          Object.entries(parameters);
          
        for (const [paramName, paramData] of paramEntries) {
          // Skip if paramData is null or undefined
          if (!paramData) continue;
          
          // Get humanScore safely
          const humanScore = paramData.humanScore !== undefined ? paramData.humanScore : null;
          
          // Get score safely
          const aiScore = paramData.score !== undefined ? paramData.score : null;
          
          // Skip N/A scores with safe null checks
          if ((humanScore !== null && humanScore === -1) || 
              (humanScore === null && aiScore !== null && aiScore === -1)) {
            continue;
          }
          
          // Get score from human evaluation if available, otherwise from AI
          const score = humanScore !== null ? humanScore : (aiScore || 0);
            
          // Add to totals
          rawScore += score;
          
          // Default max score is 5
          maxScore += 5;
        }
      }
      
      // Set the scores directly - with safe initialization
      if (!this.evaluationData) {
        this.evaluationData = { evaluation: {} };
      }
      if (!this.evaluationData.evaluation) {
        this.evaluationData.evaluation = {};
      }
      
      console.log('Calculated scores:', rawScore, maxScore);
      
      // CRITICAL: Save totalScore and maxScore directly to ensure dashboard compatibility
      this.evaluationData.evaluation.totalScore = rawScore;
      this.evaluationData.evaluation.maxScore = maxScore;
      
      // Ensure they're marked as modified
      this.markModified('evaluationData');
      this.markModified('evaluationData.evaluation');
      this.markModified('evaluationData.evaluation.totalScore');
      this.markModified('evaluationData.evaluation.maxScore');
      
      // Safely initialize or update sectionScores
      const percentage = maxScore > 0 ? Math.round((rawScore / maxScore) * 100) : 0;
      
      // Initialize sectionScores if not present or has null sections
      if (!this.sectionScores || !this.sectionScores.sections) {
        this.sectionScores = {
          sections: {
            default: {
              name: "Default Group",
              rawScore: rawScore,
              maxScore: maxScore,
              adjustedScore: rawScore, // No classification impact applied in this simple fix
              percentage: percentage,
              parameters: [],
              classifications: {
                minor: false,
                moderate: false,
                major: false
              },
              highestClassification: null,
              highestClassificationImpact: 0
            }
          },
          overall: {
            rawScore: rawScore,
            adjustedScore: rawScore, // No classification impact in simple fix
            maxScore: maxScore,
            percentage: percentage
          }
        };
      } else {
        // Update existing sectionScores with null checking
        if (!this.sectionScores.overall) {
          this.sectionScores.overall = {};
        }
        
        this.sectionScores.overall.rawScore = rawScore;
        this.sectionScores.overall.adjustedScore = rawScore;
        this.sectionScores.overall.maxScore = maxScore;
        this.sectionScores.overall.percentage = percentage;
        
        // Update default section if it exists
        if (this.sectionScores.sections && this.sectionScores.sections.default) {
          this.sectionScores.sections.default.rawScore = rawScore;
          this.sectionScores.sections.default.maxScore = maxScore;
          this.sectionScores.sections.default.adjustedScore = rawScore;
          this.sectionScores.sections.default.percentage = percentage;
        } else if (this.sectionScores.sections) {
          // Create default section if missing
          this.sectionScores.sections.default = {
            name: "Default Group",
            rawScore: rawScore,
            maxScore: maxScore,
            adjustedScore: rawScore,
            percentage: percentage,
            parameters: [],
            classifications: {
              minor: false,
              moderate: false,
              major: false
            },
            highestClassification: null,
            highestClassificationImpact: 0
          };
        }
      }
      
      // Mark sectionScores as modified
      this.markModified('sectionScores');
      
      // Then try to use the scoring service for a more accurate calculation
      try {
        const scoringService = require('../services/scoringService');
        const scores = await scoringService.calculateEvaluationScores(this, this.qaFormId);
        
        // Update with the more accurate scores if valid
        if (scores && scores.overall) {
          this.sectionScores = scores;
          
          // CRITICAL: Update both places to ensure dashboard compatibility
          this.evaluationData.evaluation.totalScore = scores.overall.adjustedScore;
          this.evaluationData.evaluation.maxScore = scores.overall.maxScore;
          
          // Mark these as modified again to be sure
          this.markModified('evaluationData');
          this.markModified('evaluationData.evaluation');
          this.markModified('evaluationData.evaluation.totalScore');
          this.markModified('evaluationData.evaluation.maxScore');
          this.markModified('sectionScores');
        }
      } catch (scoreError) {
        console.warn('Error using scoring service:', scoreError.message);
        // Continue with the manually calculated scores
      }
      
      console.log('Final scores in pre-save hook:',
        'totalScore:', this.evaluationData.evaluation.totalScore,
        'maxScore:', this.evaluationData.evaluation.maxScore);
    }
    
    next();
  } catch (error) {
    console.error('Error in pre-save hook:', error);
    next(error);
  }
});*/

// Create models
const InteractionAIQA = mongoose.model('InteractionAIQA', interactionAIQASchema);
const InteractionTranscription = mongoose.model('InteractionTranscription', transcriptionSchema);

// Add debug logging for models
console.log('\n=== MongoDB Models ===');
console.log('InteractionAIQA collection:', InteractionAIQA.collection.name);
console.log('InteractionTranscription collection:', InteractionTranscription.collection.name);
console.log('===================\n');

const schedulerSchema = new mongoose.Schema({
  enabled: {
    type: Boolean,
    default: false
  },
  cronExpression: {
    type: String,
    default: '0 17 * * *'  // Default to 5:00 PM daily
  },
  maxEvaluations: {
    type: Number,
    default: 50,
    min: 1,
    max: 1000
  },
  evaluatorId: {
    type: String,
    default: 'system'
  },
  evaluatorName: {
    type: String,
    default: 'Automated System'
  },
  lastRun: {
    type: Date
  },
  lastRunStatus: {
    type: String,
    enum: ['success', 'partial', 'failed', null],
    default: null
  },
  lastRunSummary: {
    interactionsFound: Number,
    interactionsProcessed: Number,
    error: String
  }
});

// Update the existing criteriaProfileSchema by adding the scheduler field
const criteriaProfileSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  queues: [{
    queueId: String,
    queueName: String
  }],
  workCodes: [{
    code: String,
    description: String
  }],
  agents: [{
    agentId: String,
    agentName: String
  }],
  minCallDuration: {
    type: Number,  // in seconds
    required: true,
    default: 0
  },
  direction: {
    type: String,
    enum: ['inbound', 'outbound', 'all'],
    default: 'all'
  },
  evaluationForm: {
    formId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AIQAForm',
      required: true
    },
    formName: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  excludeEvaluated: {
    type: Boolean,
    default: true
  },
  scheduler: {
    type: schedulerSchema,
    default: () => ({})
  },
  createdBy: {
    type: String,
    required: true
  },
  updatedBy: {
    type: String,
    required: true
  }
}, {
  timestamps: true,
  collection: 'criteriaprofiles'
});

// Add new model for scheduler job history
const schedulerHistorySchema = new mongoose.Schema({
  profileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CriteriaProfile',
    required: true
  },
  profileName: String,
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: Date,
  status: {
    type: String,
    enum: ['success', 'partial', 'failed'],
    required: true
  },
  interactionsFound: {
    type: Number,
    default: 0
  },
  interactionsProcessed: {
    type: Number,
    default: 0
  },
  jobIds: [String],
  error: String
}, {
  timestamps: true,
  collection: 'schedulerhistory'
});

// Create the model for scheduler history
const CriteriaProfile = mongoose.model('CriteriaProfile', criteriaProfileSchema);
const SchedulerHistory = mongoose.model('SchedulerHistory', schedulerHistorySchema);
const QAForm = mongoose.model('AIQAForm', QAFormSchema);

module.exports = {
  connectMongoDB,
  InteractionAIQA,
  InteractionTranscription,
  Interactions,
  QAForm,
  CriteriaProfile,
  SchedulerHistory
};