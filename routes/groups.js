// routes/groups.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../config/database');
const tablePrefix = process.env.TABLE_PREFIX || 'yovo_tbl_';

router.use(authenticateToken);

// Get all groups
router.get('/', async (req, res) => {
  try {
    const [groups] = await db.query(
      `SELECT * FROM ${tablePrefix}aiqa_groups ORDER BY name`
    );
    res.json(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ message: 'Error fetching groups' });
  }
});

// Get a specific group by ID
router.get('/:id', async (req, res) => {
  try {
    const [groups] = await db.query(
      `SELECT * FROM ${tablePrefix}aiqa_groups WHERE id = ?`,
      [req.params.id]
    );
    
    if (groups.length === 0) {
      return res.status(404).json({ message: 'Group not found' });
    }
    
    res.json(groups[0]);
  } catch (error) {
    console.error('Error fetching group:', error);
    res.status(500).json({ message: 'Error fetching group' });
  }
});

// Create a new group
router.post('/', async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    
    if (!name || !permissions) {
      return res.status(400).json({ message: 'Name and permissions are required' });
    }
    
    // Validate permissions format
    try {
      if (typeof permissions === 'string') {
        JSON.parse(permissions);
      }
    } catch (e) {
      return res.status(400).json({ message: 'Invalid permissions format' });
    }
    
    const [result] = await db.query(
      `INSERT INTO ${tablePrefix}aiqa_groups (name, description, permissions) VALUES (?, ?, ?)`,
      [
        name, 
        description || '', 
        typeof permissions === 'string' ? permissions : JSON.stringify(permissions)
      ]
    );
    
    res.status(201).json({ 
      id: result.insertId,
      name,
      description,
      permissions
    });
  } catch (error) {
    console.error('Error creating group:', error);
    
    // Check for duplicate name error
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'A group with this name already exists' });
    }
    
    res.status(500).json({ message: 'Error creating group' });
  }
});

// Update a group
router.put('/:id', async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    const groupId = req.params.id;
    
    if (!name || !permissions) {
      return res.status(400).json({ message: 'Name and permissions are required' });
    }
    
    // Validate permissions format
    try {
      if (typeof permissions === 'string') {
        JSON.parse(permissions);
      }
    } catch (e) {
      return res.status(400).json({ message: 'Invalid permissions format' });
    }
    
    const [result] = await db.query(
      `UPDATE ${tablePrefix}aiqa_groups SET name = ?, description = ?, permissions = ? WHERE id = ?`,
      [
        name, 
        description || '', 
        typeof permissions === 'string' ? permissions : JSON.stringify(permissions),
        groupId
      ]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Group not found' });
    }
    
    res.json({ 
      id: groupId,
      name,
      description,
      permissions
    });
  } catch (error) {
    console.error('Error updating group:', error);
    
    // Check for duplicate name error
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'A group with this name already exists' });
    }
    
    res.status(500).json({ message: 'Error updating group' });
  }
});

// Delete a group
router.delete('/:id', async (req, res) => {
  try {
    const groupId = req.params.id;
    
    // Check if the group exists
    const [groups] = await db.query(
      `SELECT * FROM ${tablePrefix}aiqa_groups WHERE id = ?`,
      [groupId]
    );
    
    if (groups.length === 0) {
      return res.status(404).json({ message: 'Group not found' });
    }
    
    // Check if there are users in this group
    const [usersInGroup] = await db.query(
      `SELECT user_id FROM ${tablePrefix}aiqa_users_groups WHERE group_id = ?`,
      [groupId]
    );
    
    if (usersInGroup.length > 0) {
      return res.status(400).json({ 
        message: 'Group has associated users',
        users: usersInGroup.map(u => u.user_id),
        requiresReassignment: true
      });
    }
    
    // Delete the group if no users are associated
    const [result] = await db.query(
      `DELETE FROM ${tablePrefix}aiqa_groups WHERE id = ?`,
      [groupId]
    );
    
    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ message: 'Error deleting group' });
  }
});

// Reassign users and delete group
router.post('/:id/reassign-and-delete', async (req, res) => {
  const connection = await db.pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const groupId = req.params.id;
    const { newGroupId } = req.body;
    
    if (!newGroupId) {
      return res.status(400).json({ message: 'New group ID is required' });
    }
    
    // Check if the new group exists
    const [newGroups] = await connection.query(
      `SELECT * FROM ${tablePrefix}aiqa_groups WHERE id = ?`,
      [newGroupId]
    );
    
    if (newGroups.length === 0) {
      return res.status(404).json({ message: 'New group not found' });
    }
    
    // Update user group assignments
    await connection.query(
      `UPDATE ${tablePrefix}aiqa_users_groups SET group_id = ? WHERE group_id = ?`,
      [newGroupId, groupId]
    );
    
    // Delete the old group
    await connection.query(
      `DELETE FROM ${tablePrefix}aiqa_groups WHERE id = ?`,
      [groupId]
    );
    
    await connection.commit();
    
    res.json({ message: 'Users reassigned and group deleted successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Error reassigning users and deleting group:', error);
    res.status(500).json({ message: 'Error reassigning users and deleting group' });
  } finally {
    connection.release();
  }
});

// Get users in a group
router.get('/:id/users', async (req, res) => {
  try {
    const groupId = req.params.id;
    
    // First verify the group exists
    const [groups] = await db.query(
      `SELECT * FROM ${tablePrefix}aiqa_groups WHERE id = ?`,
      [groupId]
    );
    
    if (groups.length === 0) {
      return res.status(404).json({ message: 'Group not found' });
    }
    
    // Get users in the group with their details
    const [users] = await db.query(
      `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.active as is_active, u.active
       FROM ${tablePrefix}aiqa_users_groups ug
       JOIN ${tablePrefix}users u ON ug.user_id = u.id
       WHERE ug.group_id = ?`,
      [groupId]
    );
    
    res.json(users);
  } catch (error) {
    console.error('Error fetching users in group:', error);
    res.status(500).json({ message: 'Error fetching users in group' });
  }
});

// Add a user to a group
router.post('/:id/users', async (req, res) => {
  try {
    const groupId = req.params.id;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    // Check if the group exists
    const [groups] = await db.query(
      `SELECT * FROM ${tablePrefix}aiqa_groups WHERE id = ?`,
      [groupId]
    );
    
    if (groups.length === 0) {
      return res.status(404).json({ message: 'Group not found' });
    }
    
    // Check if the user exists
    const [users] = await db.query(
      `SELECT * FROM ${tablePrefix}users WHERE id = ?`,
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if the user is already in the group
    const [existingAssignment] = await db.query(
      `SELECT * FROM ${tablePrefix}aiqa_users_groups WHERE user_id = ? AND group_id = ?`,
      [userId, groupId]
    );
    
    if (existingAssignment.length > 0) {
      return res.status(400).json({ message: 'User is already in this group' });
    }
    
    // Add the user to the group
    await db.query(
      `INSERT INTO ${tablePrefix}aiqa_users_groups (user_id, group_id) VALUES (?, ?)`,
      [userId, groupId]
    );
    
    res.status(201).json({ message: 'User added to group successfully' });
  } catch (error) {
    console.error('Error adding user to group:', error);
    res.status(500).json({ message: 'Error adding user to group' });
  }
});

// Remove a user from a group
router.delete('/:id/users/:userId', async (req, res) => {
  try {
    const { id: groupId, userId } = req.params;
    
    // Check if the assignment exists
    const [existingAssignment] = await db.query(
      `SELECT * FROM ${tablePrefix}aiqa_users_groups WHERE user_id = ? AND group_id = ?`,
      [userId, groupId]
    );
    
    if (existingAssignment.length === 0) {
      return res.status(404).json({ message: 'User is not assigned to this group' });
    }
    
    // Remove the user from the group
    await db.query(
      `DELETE FROM ${tablePrefix}aiqa_users_groups WHERE user_id = ? AND group_id = ?`,
      [userId, groupId]
    );
    
    res.json({ message: 'User removed from group successfully' });
  } catch (error) {
    console.error('Error removing user from group:', error);
    res.status(500).json({ message: 'Error removing user from group' });
  }
});

// Get users not in a group
router.get('/:id/available-users', async (req, res) => {
  try {
    const groupId = req.params.id;
    
    // Verify the group exists
    const [groups] = await db.query(
      `SELECT * FROM ${tablePrefix}aiqa_groups WHERE id = ?`,
      [groupId]
    );
    
    if (groups.length === 0) {
      return res.status(404).json({ message: 'Group not found' });
    }
    
    // Get all users who are not already in this group
    const [users] = await db.query(
      `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.active as is_active, u.active
       FROM ${tablePrefix}users u
       WHERE u.id NOT IN (
         SELECT user_id FROM ${tablePrefix}aiqa_users_groups WHERE group_id = ?
       )`,
      [groupId]
    );
    
    res.json(users);
  } catch (error) {
    console.error('Error fetching available users:', error);
    res.status(500).json({ message: 'Error fetching available users' });
  }
});

module.exports = router;