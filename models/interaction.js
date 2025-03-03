// models/interaction.js
const mongoose = require('mongoose');

// Caller Schema
const callerSchema = new mongoose.Schema({
  username: String,
  name: String,
  pictureURL: String,
  id: String
});

// Hold Details Schema
const holdSchema = new mongoose.Schema({
  status: Boolean,
  details: [{
    startTime: Date,
    endTime: Date,
    duration: Number
  }]
});

// Queue Schema
const queueSchema = new mongoose.Schema({
  inQueue: Boolean,
  name: String,
  startDtTime: String,
  endDtTime: String,
  duration: Number,
  ringTime: Number
});

// Bot Schema
const botSchema = new mongoose.Schema({
  active: Boolean,
  status: Boolean,
  journey: Boolean,
  hangup: Boolean,
  startDtTime: String,
  endDtTime: String,
  duration: Number
});

// Connection Schema
const connectSchema = new mongoose.Schema({
  active: Boolean,
  status: Boolean,
  startDtTime: String,
  endDtTime: String,
  duration: Number
});

// Contact Schema
const contactSchema = new mongoose.Schema({
  id: Number,
  userName: String,
  firstName: String,
  lastName: String,
  customerType: String,
  email: String,
  number: String,
  numbers: [{
    id: Number,
    number: String,
    numberType: Number,
    default: Number,
  }],
  associated_company_name: String,
  type_contact: String
});

// Participant Schema
const participantSchema = new mongoose.Schema({
  joinDtTime: String,
  leaveDtTime: String,
  isAdmin: Boolean,
  status: Boolean,
  id: String,
  name: String,
  role: String,
  callParams: {
    uniqueId: String,
    channelId: String,
    sipInterface: String
  },
  inCall: Boolean
});

// Main Interaction Schema
const interactionSchema = new mongoose.Schema({
  caller: callerSchema,
  hold: holdSchema,
  queue: queueSchema,
  bot: botSchema,
  connect: connectSchema,
  wrapUp: {
    status: Boolean,
    startDtTime: String,
    endDtTime: String,
    wrapUpTime: Number
  },
  transfer: {
    status: Boolean,
    details: Array
  },
  abandoned: {
    status: Boolean,
    dtTime: String,
    reason: String
  },
  pageQueue: String,
  channelQueue: String,
  direction: Number,
  ringTime: Number,
  firstResponseTime: Number,
  averageResponseTime: Number,
  contact: contactSchema,
  participants: [participantSchema],
  agent: {
    id: Number,
    name: String,
    username: String
  },
  channel: String,
  extension: String,
  extraPayload: {
    callRecording: {
      fileName: String,
      filePath: String,
      webPath: String
    },
    ticketId: Number,
    ticketNumber: Number
  },
  created: {
    year: String,
    month: String,
    day: String,
    hour: String,
    minutes: String
  }
}, { timestamps: true });

const Interaction = mongoose.model('Interaction', interactionSchema);

module.exports = Interaction;