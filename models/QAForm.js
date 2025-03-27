// models/QAForm.js
const mongoose = require('mongoose');

// Schema for individual parameters (questions)
const parameterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  context: {
    type: String,
    required: true
  },
  maxScore: {
    type: Number,
    default: 5,
    min: 1,
    max: 10
  },
  scoringType: {
    type: String,
    enum: ['binary', 'variable'],
    default: 'variable'
  },
  order: {
    type: Number,
    default: 0
  },
  // New field to associate the parameter with a group
  group: {
    type: String,
    default: 'default',
    required: true
  },
  // New field to classify the parameter
  classification: {
    type: String,
    enum: ['minor', 'moderate', 'major'],
    default: 'minor',
    required: true
  }
});

// Schema for question groups
const groupSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  }
});

// Main QA Form schema
const QAFormSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  parameters: [parameterSchema],
  // New field to store groups
  groups: {
    type: [groupSchema],
    default: [{ id: 'default', name: 'Default Group' }],
    validate: {
      validator: function(groups) {
        return groups && groups.length > 0;
      },
      message: 'At least one group is required'
    }
  },
  createdBy: {
    type: Number,
    ref: 'User'
  },
  updatedBy: {
    type: Number,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Add validation to ensure every parameter has a valid group
QAFormSchema.pre('validate', function(next) {
  // Get all group IDs
  const groupIds = this.groups.map(group => group.id);
  
  // Check if every parameter references a valid group
  const allValid = this.parameters.every(param => 
    groupIds.includes(param.group)
  );
  
  if (!allValid) {
    this.invalidate('parameters', 'All parameters must reference a valid group');
  }
  
  next();
});

module.exports = QAFormSchema;