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

const disputeResolutionSchema = new mongoose.Schema({
  resolvedBy: {
    type: String,
    required: true
  },
  resolvedByName: {
    type: String,
    required: true
  },
  resolution: {
    type: String,
    enum: ['accept', 'reject'],
    required: true
  },
  comments: {
    type: String,
    default: ''
  },
  resolvedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false, strict: false });

// Cost model schema to track expenses for each evaluation
const costModelSchema = new mongoose.Schema({
  // Speech to text costs
  sttDuration: {
    type: Number, // In seconds
    default: 0
  },
  sttCost: {
    type: Number,
    default: 0
  },
  sttPrice: {
    type: Number,
    default: 0
  },
  
  // OpenAI costs
  promptTokens: {
    type: Number,
    default: 0
  },
  promptCost: {
    type: Number,
    default: 0
  },
  promptPrice: {
    type: Number,
    default: 0
  },
  
  completionTokens: {
    type: Number,
    default: 0
  },
  completionCost: {
    type: Number,
    default: 0
  },
  completionPrice: {
    type: Number,
    default: 0
  },
  
  // Total costs
  totalCost: {
    type: Number,
    default: 0
  },
  totalPrice: {
    type: Number,
    default: 0
  },
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date
  },
  updatedBy: {
    type: String
  }
}, { _id: false, strict: false });

const enhancedTranscriptionSchema = new mongoose.Schema({
  interactionId: { type: String, required: true },
  transcriptionVersion: { 
    type: String, 
    enum: ['realtime', 'recorded', 'messages'], 
    default: 'realtime' 
  },
  transcription: [mongoose.Schema.Types.Mixed],
  
  // New fields for message-based interactions
  metadata: {
    totalMessages: {
      type: Number,
      default: 0
    },
    participants: [String],
    channels: [String],
    hasMultimedia: {
      type: Boolean,
      default: false
    },
    timespan: {
      start: Date,
      end: Date
    }
  },
  
  // Enhanced sentiment analysis for text conversations
  sentimentAnalysis: {
    sentiment: {
      score: Number,
      sentiment: String
    },
    profanity: {
      score: Number,
      words: [String]
    },
    intents: [String],
    language: String,
    translationInEnglish: String,
    usage: {
      prompt_tokens: Number,
      completion_tokens: Number,
      total_tokens: Number,
      prompt_tokens_details: {
        cached_tokens: Number,
        audio_tokens: Number
      },
      completion_tokens_details: {
        reasoning_tokens: Number,
        audio_tokens: Number,
        accepted_prediction_tokens: Number,
        rejected_prediction_tokens: Number
      }
    }
  }
}, { 
  collection: 'interactiontranscriptions',
  timestamps: true,
  strict: false 
});

const enhancedInteractionDataSchema = new mongoose.Schema({
  queue: {
    name: String
  },
  agent: {
    id: String,
    name: String
  },
  caller: {
    id: String,
    name: String
  },
  direction: String,
  duration: Number,
  channel: String,
  
  // New fields for message-based interactions
  messageCount: {
    type: Number,
    default: 0
  },
  hasMultimedia: {
    type: Boolean,
    default: false
  },
  averageResponseTime: {
    type: Number,
    default: 0
  },
  conversationSummary: {
    type: String,
    default: null
  }
}, { _id: false, strict: false });

// Update the existing interactionAIQASchema with enhanced interaction data
// Replace the existing interactionData field with this enhanced version
const updatedInteractionAIQASchema = new mongoose.Schema({
  interactionId: { type: String, required: true },
  qaFormName: { type: String, required: true },
  qaFormId: { type: String, required: true },
  evaluator: {
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
  
  // Enhanced interaction data supporting both audio and text channels
  interactionData: enhancedInteractionDataSchema,
  
  status: {
    type: String,
    enum: ['pending', 'completed', 'moderated', 'published', 'disputed'],
    default: 'pending'
  },
  
  // Processing metadata
  processingType: {
    type: String,
    enum: ['audio', 'text'],
    default: 'audio'
  },
  
  // Human evaluation data (existing)
  humanEvaluation: {
    type: humanEvaluationSchema,
    default: null
  },
  
  // Dispute resolution (existing)
  disputeResolution: {
    type: disputeResolutionSchema,
    default: null
  },
  
  // Cost model (existing)
  costModel: {
    type: costModelSchema,
    default: null
  }
}, { 
  collection: 'interactionaiqas',
  timestamps: true 
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

// Interactions Schema
const Interactions = require('../models/interaction');

// Create models
const InteractionAIQA = mongoose.model('InteractionAIQA', updatedInteractionAIQASchema);
const InteractionTranscription = mongoose.model('InteractionTranscription', enhancedTranscriptionSchema);

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
    enum: ['0', '1', 'all'],
    default: 'all'
  },
  durationComparison: {  // Add this field
    type: String,
    enum: ['>', '<', '='],
    default: '>'
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

const contextGeneratorUsageSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  username: String,
  timestamp: {
    type: Date,
    default: Date.now
  },
  paramName: {
    type: String,
    required: true
  },
  cost: {
    type: Number,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  existingContext: String,
  scoringType: String,
  maxScore: Number,
  classification: String
}, {
  collection: 'contextgeneratorusage',
  timestamps: true
});

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
    enum: ['pending', 'completed', 'moderated', 'published', 'disputed'],
    default: 'pending'
  },
  
  // Human evaluation data
  humanEvaluation: {
    type: humanEvaluationSchema,
    default: null
  },
  disputeResolution: {
    type: disputeResolutionSchema,
    default: null
  },
  costModel: {
    type: costModelSchema,
    default: null
  }
}, { 
  collection: 'interactionaiqas',
  timestamps: true 
});

const ContextGeneratorUsage = mongoose.model('ContextGeneratorUsage', contextGeneratorUsageSchema);

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
  SchedulerHistory,
  ContextGeneratorUsage  
};