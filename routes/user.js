// routes/user.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcryptjs');
const { authenticateToken } = require('../middleware/auth');
const tablePrefix = process.env.TABLE_PREFIX;

// Protect all routes
router.use(authenticateToken);

router.post('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        message: 'Current password and new password are required' 
      });
    }

    // Get user's current password
    const [users] = await db.query(
      `SELECT password FROM ${tablePrefix}users WHERE id = ?`,
      [userId]
    );

    if (!users.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, users[0].password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    await db.query(
      `UPDATE ${tablePrefix}users SET password = ? WHERE id = ?`,
      [hashedPassword, userId]
    );

    // Log the password change
    await db.query(
      `INSERT INTO ${tablePrefix}password_history (user_id, password_hash) VALUES (?, ?)`,
      [userId, hashedPassword]
    );

    res.json({ message: 'Password changed successfully' });

  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ message: 'Error changing password' });
  }
});

// Get user permissions
router.get('/permissions', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        g.permissions,
        g.name as group_name
      FROM ${tablePrefix}users u
      LEFT JOIN ${tablePrefix}aiqa_users_groups ug ON u.id = ug.user_id
      LEFT JOIN ${tablePrefix}aiqa_groups g ON ug.group_id = g.id
      WHERE u.id = ?
    `, [req.user.id]);

    console.log(rows)

    // Default permissions for all users - at minimum they can view dashboards and QA forms
    let defaultPermissions = {
      'dashboard': { 'read': true },
      'qa-forms': { 'read': true }
    };

    try {
      // Log the raw permissions for debugging
      //console.log('Raw permissions:', rows[0].permissions);
      
      // Parse permissions
      let userPermissions = rows[0].permissions;
      
      // If permissions is already an object, stringify it first
      if (!userPermissions || Object.keys(userPermissions).length === 0) {
        console.log('No permissions found for user, providing defaults');
        
        // If user is an agent but not admin, provide agent-specific permissions
        if (req.user.isAgent && !req.user.isAdmin) {
          defaultPermissions['evaluations'] = { 'read': true };
        }
        
        // If user is an admin, provide admin-specific permissions
        if (req.user.isAdmin) {
          defaultPermissions['qa-forms']['write'] = true;
          defaultPermissions['evaluations'] = { 'read': true, 'write': true };
          defaultPermissions['groups'] = { 'read': true };
        }
        
        return res.json(defaultPermissions);
      }
      
      const parsedPermissions = (userPermissions);
      //console.log('Parsed permissions:', parsedPermissions);
      
      res.json(parsedPermissions);
    } catch (parseError) {
      console.error('Error parsing permissions:', parseError);
      console.log('Problematic permissions string:', rows[0].permissions);
      res.json(defaultPermissions);
    }
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Error fetching permissions' });
  }
});

// Get user profile
router.get('/profile', async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const [users] = await db.query(
      `SELECT id, username, email, first_name, last_name, last_login FROM ${tablePrefix}users WHERE id = ?`,
      [req.user.id]
    );

    if (!users.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ message: 'Error fetching profile' });
  }
});

// Update user profile
router.put('/profile', async (req, res) => {
  try {
    const { first_name, last_name, email } = req.body;
    
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    await db.query(
      'UPDATE users SET first_name = ?, last_name = ?, email = ? WHERE id = ?',
      [first_name, last_name, email, req.user.id]
    );

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Error updating profile' });
  }
});


module.exports = router;