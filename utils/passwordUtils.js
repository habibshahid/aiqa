// utils/passwordUtils.js
const bcrypt = require('bcryptjs');
const db = require('../config/database');

async function createAdminUser(username, email, password) {
  try {
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert admin user
    const [result] = await db.query(
      `INSERT INTO users (username, email, password, is_active) 
       VALUES (?, ?, ?, true)`,
      [username, email, hashedPassword]
    );

    // Assign admin group
    await db.query(
      'INSERT INTO users_groups (user_id, group_id) VALUES (?, (SELECT id FROM groups WHERE name = "Admin"))',
      [result.insertId]
    );

    console.log('Admin user created successfully');
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
}

// Usage example:
createAdminUser('habibshahid', 'habibshahid@gmail.com', 'securepassword123');

async function resetUserPassword(userId, newPassword) {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await db.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, userId]
    );

    console.log('Password reset successfully');
  } catch (error) {
    console.error('Error resetting password:', error);
  }
}

module.exports = {
  createAdminUser,
  resetUserPassword
};