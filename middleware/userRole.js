// middleware/userRole.js
const db = require('../config/database');
const tablePrefix = process.env.TABLE_PREFIX || 'yovo_tbl_';

/**
 * Middleware to determine if a user is an admin or not
 * Adds isAdmin and agentId properties to req.user
 */
// Update in middleware/userRole.js
const determineUserRole = async (req, res, next) => {
  // Skip if no authenticated user
  if (!req.user) {
    return next();
  }

  try {
    // Check if the user is_agent flag is set
    const [userDetails] = await db.query(
      `SELECT id, is_agent FROM ${tablePrefix}users WHERE id = ?`,
      [req.user.id]
    );
    
    if (userDetails.length === 0) {
      // User not found in database
      req.user.isAdmin = false;
      req.user.isAgent = false;
      return next();
    }
    
    // IMPORTANT: Set isAdmin based on is_agent=0
    req.user.isAdmin = userDetails[0].is_agent === 0;
    req.user.isAgent = userDetails[0].is_agent === 1;
    
    // If the user is an agent (not an admin), they should only see their own data
    if (req.user.isAgent && !req.user.isAdmin) {
      req.user.agentId = req.user.id;
    }
    
    next();
  } catch (error) {
    console.error('Error determining user role:', error);
    // Continue without role info rather than breaking the app
    req.user.isAdmin = false;
    req.user.isAgent = false;
    next();
  }
};

module.exports = {
  determineUserRole
};