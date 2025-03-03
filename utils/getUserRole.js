// utils/getUserRole.js
const db = require('../config/database');
const tablePrefix = process.env.TABLE_PREFIX || 'yovo_tbl_';

/**
 * Utility function to determine if a user is an admin or agent
 * @param {number} userId - User ID
 * @returns {Promise<{isAgent: boolean, isAdmin: boolean}>} User role information
 */
async function getUserRole(userId) {
  try {
    // Check if the user is_agent flag is set
    const [userDetails] = await db.query(
      `SELECT id, is_agent FROM ${tablePrefix}users WHERE id = ?`,
      [userId]
    );
    
    if (userDetails.length === 0) {
      // User not found in database
      return { isAgent: false, isAdmin: false };
    }
    
    // Set the agent flag based on the is_agent column
    const isAgent = userDetails[0].is_agent === 1;
    
    // Check permissions to determine if user is admin
    const [userGroups] = await db.query(
      `SELECT g.id, g.permissions 
       FROM ${tablePrefix}aiqa_users_groups ug
       JOIN ${tablePrefix}aiqa_groups g ON ug.group_id = g.id
       WHERE ug.user_id = ?`,
      [userId]
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
    
    return { 
      isAgent, 
      isAdmin,
      agentId: isAgent && !isAdmin ? userId : null
    };
  } catch (error) {
    console.error('Error determining user role:', error);
    return { isAgent: false, isAdmin: false, agentId: null };
  }
}

module.exports = {
  getUserRole
};