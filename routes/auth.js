// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { generateToken, revokeToken } = require('../middleware/auth');
const db = require('../config/database');
const { loginValidation, validateRequest } = require('../middleware/validation');
const { verifyPassword, hashPassword } = require('../services/passwordService');
const tablePrefix = process.env.TABLE_PREFIX;

router.post('/login', loginValidation, validateRequest, async (req, res) => {
  try {
    const { username, password } = req.body;

    // Get user
    const [users] = await db.query(
      `SELECT * FROM ${tablePrefix}users WHERE username = ? OR email = ?`,
      [username, username]
    );

    if (!users.length || !users[0].active) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = await generateToken(user, req);

    // Update last login
    await db.query(
      `UPDATE ${tablePrefix}users SET last_login = NOW() WHERE id = ?`,
      [user.id]
    );

    // Remove sensitive data
    delete user.password;

    const isAdmin = (user.is_agent && user.is_agent == 1) ? 0 : 1;
    const isAgent = (user.is_agent && user.is_agent == 1) ? 1 : 0;

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        isAdmin: isAdmin,
        isAgent: isAgent
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Logout route
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        await revokeToken(decoded.jti);
      } catch (error) {
        console.error('Error decoding token during logout:', error);
      }
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error during logout' });
  }
});

module.exports = router;