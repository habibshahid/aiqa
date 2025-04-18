// middleware/agentRestriction.js
/**
 * Middleware to restrict agents to their own data
 * This adds agent ID filters to queries for agent users
 */
const enforceAgentRestriction = (req, res, next) => {
    // Skip if no authenticated user
    if (!req.user) {
      return next();
    }
  
    // If user is an agent but not admin, add agent filtering
    if (req.user.isAgent && !req.user.isAdmin) {
      // Add agent ID to query params if not already present
      if (!req.query.agentId) {
        req.query.agentId = req.user.id;
      }
      
      // Set header to inform client this is a restricted view
      res.set('X-Restricted-View', 'agent-only');
    }
  
    next();
  };
  
  module.exports = {
    enforceAgentRestriction
  };