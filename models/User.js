// models/User.js
const mongoose = require('mongoose');

// Extend the existing user schema to include role information
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  first_name: {
    type: String,
    trim: true
  },
  last_name: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  is_agent: {
    type: Number,
    default: 1, // 1 = agent, 0 = admin
    enum: [0, 1]
  },
  is_active: {
    type: Boolean,
    default: true
  },
  agent_id: {
    type: String,
    sparse: true // Only agents will have this populated
  },
  permissions: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  last_login: {
    type: Date
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'users',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Team schema
const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  is_active: {
    type: Boolean,
    default: true
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'teams',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Team members schema
const teamMemberSchema = new mongoose.Schema({
  team_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  team_lead: {
    type: Number,
    default: 0,
    enum: [0, 1]
  },
  added_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'team_members',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Create indexes for faster lookups
teamMemberSchema.index({ team_id: 1, user_id: 1 }, { unique: true });
teamMemberSchema.index({ user_id: 1 });
teamMemberSchema.index({ team_id: 1, team_lead: 1 });

// Create models
const User = mongoose.model('User', userSchema);
const Team = mongoose.model('Team', teamSchema);
const TeamMember = mongoose.model('TeamMember', teamMemberSchema);

module.exports = {
  User,
  Team,
  TeamMember
};