// routes/index.js
const express = require('express');
const router = express.Router();
const authRoutes = require('./auth');
const userRoutes = require('./user');
const qaRoutes = require('./qa');
const qaProcessRoutes = require('./qaProcess');
const dashboardRoutes = require('./dashboard');
const queueRoutes = require('./queues');
const agentRoutes = require('./agents');
const qaFormsRoutes = require('./qaForms');
const criteriaProfileRoutes = require('./criteriaProfile');
const workCodesRoutes = require('./workCodes');
const interactionsRoutes = require('./interactions');
const couchingRoutes = require('./coaching');
const analyticsRoutes = require('./analytics');
const exportsRoutes = require('./exports');
const groupsRoutes = require('./groups');

const { authenticateToken } = require('../middleware/auth');
// Public routes
router.use('/auth', authRoutes);

// Protected routes
router.use('/user', authenticateToken, userRoutes);
router.use('/qa', authenticateToken, qaRoutes);
router.use('/qa-process', authenticateToken, qaProcessRoutes);
router.use('/dashboard', authenticateToken, dashboardRoutes);
router.use('/qa-forms', authenticateToken, qaFormsRoutes);
router.use('/queues', authenticateToken, queueRoutes);
router.use('/agents', authenticateToken, agentRoutes);
router.use('/criteria-profiles', authenticateToken, criteriaProfileRoutes);
router.use('/work-codes', authenticateToken, workCodesRoutes);
router.use('/interactions', authenticateToken, interactionsRoutes);
router.use('/coaching', authenticateToken, couchingRoutes);
router.use('/analytics', authenticateToken, analyticsRoutes);
router.use('/exports', authenticateToken, exportsRoutes);
router.use('/groups', authenticateToken, groupsRoutes);

module.exports = router;