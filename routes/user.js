// routes/users.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const { verifyPassword, hashPassword } = require('../services/passwordService');
const { determineUserRole } = require('../middleware/userRole');
const tablePrefix = process.env.TABLE_PREFIX || 'yovo_tbl_';

// Apply authentication middleware to protected routes
router.use('/profile', authenticateToken);
router.use('/permissions', authenticateToken);
router.use('/change-password', authenticateToken);
router.use('/settings', authenticateToken);

/**
 * Get user profile
 */
router.get('/profile', async (req, res) => {
  try {
    // Check if user ID exists
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Get user information from database
    const [users] = await db.query(
      `SELECT 
        id, username, first_name, last_name, email, is_agent, last_login
      FROM ${tablePrefix}users
      WHERE id = ?`,
      [req.user.id]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = users[0];
    
    // Add isAdmin and isAgent properties
    user.isAdmin = (user.is_agent === 0) ? true : false;
    user.isAgent = (user.is_agent === 1) ? true : false;

    // For agents, include agentId
    if (user.isAgent) {
      user.agentId = user.id;
    }

    res.json(user);
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ message: 'Error fetching user profile' });
  }
});

/**
 * Get user permissions from database
 */
router.get('/permissions', async (req, res) => {
  try {
    // Check if user ID exists
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    // Get user's group memberships from the junction table
    const [userGroups] = await db.query(
      `SELECT g.id, g.name, g.permissions
       FROM ${tablePrefix}aiqa_users_groups ug
       JOIN ${tablePrefix}aiqa_groups g ON ug.group_id = g.id
       WHERE ug.user_id = ?`,
      [req.user.id]
    );
    
    if (userGroups.length === 0) {
      console.log(`No groups found for user ${req.user.id}, using role-based defaults`);
      
      // Use default permissions based on is_agent flag
      const [users] = await db.query(
        `SELECT is_agent FROM ${tablePrefix}users WHERE id = ?`,
        [req.user.id]
      );
      
      if (users.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Determine if admin or agent and use appropriate defaults
      const isAdmin = users[0].is_agent === 0;
      
      // Get default permissions from groups table
      const defaultGroupId = isAdmin ? 1 : 2; // 1=Admin, 2=Agent
      
      const [defaultGroup] = await db.query(
        `SELECT permissions FROM ${tablePrefix}aiqa_groups WHERE id = ?`,
        [defaultGroupId]
      );
      
      if (defaultGroup.length === 0) {
        return res.status(404).json({ message: 'Default group not found' });
      }
      
      // Parse JSON permissions from the group
      let permissions = {};
      try {
        permissions = JSON.parse(defaultGroup[0].permissions);
      } catch (e) {
        console.error('Error parsing default group permissions:', e);
      }
      
      console.log(`Using default permissions for ${isAdmin ? 'admin' : 'agent'} user:`, permissions);
      return res.json(permissions);
    }
    
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
    
    console.log(`Final merged permissions for user ${req.user.id}:`, mergedPermissions);
    res.json(mergedPermissions);
  } catch (error) {
    console.error('Error getting user permissions:', error);
    res.status(500).json({ message: 'Error fetching user permissions' });
  }
});

/**
 * Update user profile
 */
router.put('/profile', async (req, res) => {
  try {
    const { first_name, last_name, email } = req.body;
    
    // Validate input
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    // Update user information
    await db.query(
      `UPDATE ${tablePrefix}users
       SET first_name = ?, last_name = ?, email = ?
       WHERE id = ?`,
      [first_name || null, last_name || null, email, req.user.id]
    );
    
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ message: 'Error updating user profile' });
  }
});

/**
 * Change password
 */
router.post('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Both current and new password are required' });
    }
    
    // Get user's current password hash
    const [users] = await db.query(
      `SELECT password FROM ${tablePrefix}users WHERE id = ?`,
      [req.user.id]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Verify current password
    const passwordValid = await verifyPassword(currentPassword, users[0].password);
    if (!passwordValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    
    // Hash new password
    const hashedPassword = await hashPassword(newPassword);
    
    // Update password
    await db.query(
      `UPDATE ${tablePrefix}users SET password = ? WHERE id = ?`,
      [hashedPassword, req.user.id]
    );
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ message: 'Error changing password' });
  }
});

/**
 * Get user settings
 */
router.get('/settings', async (req, res) => {
  try {
    // Get user settings from database
    const [settings] = await db.query(
      `SELECT settings FROM ${tablePrefix}user_settings WHERE user_id = ?`,
      [req.user.id]
    );
    
    if (settings.length === 0) {
      // Return default settings if none found
      return res.json({
        theme: 'light',
        notifications: true,
        language: 'en'
      });
    }
    
    // Parse settings JSON
    let userSettings = {};
    try {
      userSettings = JSON.parse(settings[0].settings);
    } catch (e) {
      console.error('Error parsing user settings:', e);
    }
    
    res.json(userSettings);
  } catch (error) {
    console.error('Error getting user settings:', error);
    res.status(500).json({ message: 'Error fetching user settings' });
  }
});

/**
 * Update user settings
 */
router.put('/settings', async (req, res) => {
  try {
    const settings = req.body;
    
    // Serialize settings to JSON
    const settingsJson = JSON.stringify(settings);
    
    // Try to update existing settings first
    const [result] = await db.query(
      `UPDATE ${tablePrefix}user_settings 
       SET settings = ? 
       WHERE user_id = ?`,
      [settingsJson, req.user.id]
    );
    
    // If no rows affected, insert new settings
    if (result.affectedRows === 0) {
      await db.query(
        `INSERT INTO ${tablePrefix}user_settings (user_id, settings)
         VALUES (?, ?)`,
        [req.user.id, settingsJson]
      );
    }
    
    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error updating user settings:', error);
    res.status(500).json({ message: 'Error updating user settings' });
  }
});

// Export the router
module.exports = router;