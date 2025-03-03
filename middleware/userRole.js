// middleware/userRole.js
const db = require('../config/database');
const tablePrefix = process.env.TABLE_PREFIX || 'yovo_tbl_';

/**
 * Middleware to determine if a user is an admin or not
 * Adds isAdmin and agentId properties to req.user
 */
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
    
    // Set the agent flag based on the is_agent column
    req.user.isAgent = userDetails[0].is_agent === 1;
    
    // Check permissions to determine if user is admin
    const [userGroups] = await db.query(
      `SELECT g.id, g.permissions 
       FROM ${tablePrefix}aiqa_users_groups ug
       JOIN ${tablePrefix}aiqa_groups g ON ug.group_id = g.id
       WHERE ug.user_id = ?`,
      [req.user.id]
    );
    
    // Default to non-admin
    let isAdmin = false;
    
    // Check each group's permissions to see if user has admin rights
    for (const group of userGroups) {
      let permissions;
      try {
        // Parse permissions if they're stored as a string
        permissions = typeof group.permissions === 'string' 
          ? JSON.parse(group.permissions) 
          : group.permissions;
      } catch (e) {
        console.error('Error parsing permissions for group:', group.id, e);
        continue;
      }
      
      // Check for admin indicators in permissions
      // User is admin if they have write permissions for major modules
      const hasAllModules = 
        permissions?.dashboard?.write && 
        permissions?.['qa-forms']?.write && 
        permissions?.users?.write && 
        permissions?.groups?.write;
      
      if (hasAllModules) {
        isAdmin = true;
        break;
      }
    }
    
    req.user.isAdmin = isAdmin;
    
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