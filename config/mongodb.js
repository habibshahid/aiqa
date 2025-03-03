// config/mongodb.js
const mongoose = require('mongoose');

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
  score: Number
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

const interactionAIQASchema = new mongoose.Schema({
  interactionId: { type: String, required: true },
  qaFormName: { type: String, required: true },
  qaFormId: { type: String, required: true },
  evaluator: {     // Add this new field
    id: String,
    name: String
  },
  evaluationData: {
    usage: usageDetailsSchema,
    evaluation: evaluationSchema
  },
  interactionData: {
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
}, { 
  collection: 'interactionaiqas',
  timestamps: true 
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

// Interactions Schema
const interactionsSchema = new mongoose.Schema({},{ 
  collection: 'interactions',  // Specify the collection name
  timestamps: true 
});

// Create models
const InteractionAIQA = mongoose.model('InteractionAIQA', interactionAIQASchema);
const InteractionTranscription = mongoose.model('InteractionTranscription', transcriptionSchema);
const Interactions = mongoose.model('Interactions', interactionsSchema);

// Add debug logging for models
console.log('\n=== MongoDB Models ===');
console.log('InteractionAIQA collection:', InteractionAIQA.collection.name);
console.log('InteractionTranscription collection:', InteractionTranscription.collection.name);
console.log('===================\n');

const qaFormParameterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  context: {
    type: String,
    required: true,
    trim: true
  },
  maxScore: {
    type: Number,
    required: true,
    min: 1
  },
  scoringType: {
    type: String,
    enum: ['binary', 'variable'],
    required: true
  },
  order: {
    type: Number,
    required: true
  }
}, { _id: true });

const qaFormSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  parameters: [qaFormParameterSchema],
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
  collection: 'aiqaforms'
});

// Create model
const QAForm = mongoose.model('AIQAForm', qaFormSchema);

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

const CriteriaProfile = mongoose.model('CriteriaProfile', criteriaProfileSchema);

module.exports = {
  connectMongoDB,
  InteractionAIQA,
  InteractionTranscription,
  Interactions,
  QAForm,
  CriteriaProfile
};