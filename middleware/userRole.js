// middleware/userRole.js
const db = require('../config/database');
const tablePrefix = process.env.TABLE_PREFIX || 'yovo_tbl_';

/**
 * Middleware to determine if a user is an admin or agent
 * Sets appropriate properties on req.user
 */
const determineUserRole = async (req, res, next) => {
  // Skip if no authenticated user
  if (!req.user) {
    return next();
  }

  try {
    console.log('Determining role for user:', req.user.id);
    
    // Check if the user is_agent flag is set
    const [userDetails] = await db.query(
      `SELECT id, is_agent FROM ${tablePrefix}users WHERE id = ?`,
      [req.user.id]
    );
    
    if (userDetails.length === 0) {
      console.log('User not found in database, defaulting to agent view');
      req.user.isAdmin = false;
      req.user.isAgent = true;
      return next();
    }
    
    // IMPORTANT: Set isAdmin based on is_agent=0
    const isAdmin = userDetails[0].is_agent === 0;
    const isAgent = userDetails[0].is_agent === 1;
    
    req.user.isAdmin = isAdmin;
    req.user.isAgent = isAgent;
    
    console.log(`User ${req.user.id} role determined: isAdmin=${isAdmin}, isAgent=${isAgent}`);
    
    // If the user is an agent (not an admin), they should only see their own data
    if (isAgent && !isAdmin) {
      req.user.agentId = req.user.id;
    }
    
    // Look up user's groups and permissions
    try {
      const [userGroups] = await db.query(
        `SELECT g.id, g.name, g.permissions
         FROM ${tablePrefix}aiqa_users_groups ug
         JOIN ${tablePrefix}aiqa_groups g ON ug.group_id = g.id
         WHERE ug.user_id = ?`,
        [req.user.id]
      );
      
      if (userGroups.length > 0) {
        console.log(`User belongs to ${userGroups.length} groups`);
        
        // Store group information for debugging
        req.user.groups = userGroups.map(g => ({
          id: g.id,
          name: g.name
        }));
        
        // Store user's primary group
        req.user.primaryGroup = userGroups[0].name;
      } else {
        console.log('User has no explicit group assignments');
        
        // Assign default group based on role
        const defaultGroupId = isAdmin ? 1 : 2; // 1=Admin, 2=Agent
        
        const [defaultGroup] = await db.query(
          `SELECT id, name FROM ${tablePrefix}aiqa_groups WHERE id = ?`,
          [defaultGroupId]
        );
        
        if (defaultGroup.length > 0) {
          req.user.primaryGroup = defaultGroup[0].name;
          req.user.groups = [{ 
            id: defaultGroup[0].id, 
            name: defaultGroup[0].name 
          }];
        }
      }
    } catch (groupError) {
      console.error('Error fetching user groups:', groupError);
    }
    
    // Store user roles in the response headers to help debug issues
    if (process.env.NODE_ENV !== 'production') {
      res.set('X-User-Roles', JSON.stringify({
        id: req.user.id,
        isAdmin,
        isAgent,
        agentId: req.user.agentId,
        primaryGroup: req.user.primaryGroup
      }));
    }
    
    next();
  } catch (error) {
    console.error('Error determining user role:', error);
    // Continue without role info rather than breaking the app
    req.user.isAdmin = false;
    req.user.isAgent = true;
    next();
  }
};

/**
 * Middleware to get user's group permissions
 * This can be used after determineUserRole to provide permissions data
 */
const getUserPermissions = async (req, res, next) => {
  // Skip if no authenticated user
  if (!req.user) {
    return next();
  }
  
  try {
    // Get user's group memberships from the junction table
    const [userGroups] = await db.query(
      `SELECT g.id, g.name, g.permissions
       FROM ${tablePrefix}aiqa_users_groups ug
       JOIN ${tablePrefix}aiqa_groups g ON ug.group_id = g.id
       WHERE ug.user_id = ?`,
      [req.user.id]
    );
    
    // If user has no group memberships, use default based on role
    if (userGroups.length === 0) {
      // Use default permissions based on is_agent flag
      const defaultGroupId = req.user.isAdmin ? 1 : 2; // 1=Admin, 2=Agent
      
      const [defaultGroup] = await db.query(
        `SELECT permissions FROM ${tablePrefix}aiqa_groups WHERE id = ?`,
        [defaultGroupId]
      );
      
      if (defaultGroup.length > 0) {
        // Parse JSON permissions from the group
        try {
          req.user.permissions = typeof defaultGroup[0].permissions === 'string' 
            ? JSON.parse(defaultGroup[0].permissions) 
            : defaultGroup[0].permissions;
        } catch (e) {
          console.error('Error parsing default group permissions:', e);
          req.user.permissions = getDefaultPermissions(req.user.isAdmin);
        }
      } else {
        // Use hardcoded defaults if no group found
        req.user.permissions = getDefaultPermissions(req.user.isAdmin);
      }
    } else {
      // Merge permissions from all groups the user belongs to
      const mergedPermissions = {};
      
      for (const group of userGroups) {
        try {
          // Parse permissions JSON from the database
          const groupPermissions = typeof group.permissions === 'string' 
            ? JSON.parse(group.permissions) 
            : group.permissions;
          
          // Merge into the accumulated permissions, giving precedence to 'true' values
          for (const [resource, actions] of Object.entries(groupPermissions)) {
            if (!mergedPermissions[resource]) {
              mergedPermissions[resource] = {};
            }
            
            for (const [action, allowed] of Object.entries(actions)) {
              // If permission is already set to true, keep it true
              mergedPermissions[resource][action] = mergedPermissions[resource][action] || allowed;
            }
          }
        } catch (e) {
          console.error(`Error parsing permissions for group ${group.id}:`, e);
        }
      }
      
      req.user.permissions = mergedPermissions;
    }
    
    next();
  } catch (error) {
    console.error('Error getting user permissions:', error);
    // Set default permissions based on role
    req.user.permissions = getDefaultPermissions(req.user.isAdmin);
    next();
  }
};

/**
 * Get default permissions based on role
 * @param {boolean} isAdmin - Whether the user is an admin
 * @returns {Object} Default permissions
 */
const getDefaultPermissions = (isAdmin) => {
  if (isAdmin) {
    return {
      'users': { 'read': true, 'write': true },
      'agents': { 'read': true, 'write': true },
      'groups': { 'read': true, 'write': true },
      'exports': { 'read': true },
      'criteria': { 'read': true, 'write': true },
      'qa-forms': { 'read': true, 'write': true, 'admin': true },
      'settings': { 'read': true, 'write': true },
      'dashboard': { 'read': true, 'write': true },
      'evaluations': { 'read': true, 'write': true },
      'trend-analysis': { 'read': true },
      'agent-comparison': { 'read': true }
    };
  } else {
    return {
      'users': { 'read': false, 'write': false },
      'agents': { 'read': false, 'write': false },
      'groups': { 'read': false, 'write': false },
      'exports': { 'read': true },
      'criteria': { 'read': false, 'write': false },
      'qa-forms': { 'read': false, 'write': false },
      'settings': { 'read': false, 'write': false },
      'dashboard': { 'read': true },
      'evaluations': { 'read': true, 'write': true },
      'trend-analysis': { 'read': true },
      'agent-comparison': { 'read': true }
    };
  }
};

module.exports = {
  determineUserRole,
  getUserPermissions,
  getDefaultPermissions
};