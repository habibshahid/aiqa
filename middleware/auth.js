// middleware/auth.js
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/database');
const { determineUserRole } = require('./userRole');
const tablePrefix = process.env.TABLE_PREFIX || 'yovo_tbl_';

const generateToken = async (user, req) => {
  try {
    const tokenId = crypto.randomBytes(16).toString('hex');
    const fingerprint = generateFingerprint(req);
    
    const token = jwt.sign(
      { 
        userId: user.id,
        username: user.username,
        jti: tokenId 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '8h' }
    );

    // Store login information
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 8);

    await db.query(
      `INSERT INTO ${tablePrefix}user_logins (
        user_id, token_id, fingerprint, ip_address, user_agent, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        tokenId,
        fingerprint,
        req.ip,
        req.headers['user-agent'],
        expiresAt
      ]
    );

    return token;
  } catch (error) {
    console.error('Error generating token:', error);
    throw error;
  }
};

const revokeToken = async (tokenId) => {
  try {
    // Add to blacklist
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 8);

    await db.query(
      `INSERT INTO ${tablePrefix}token_blacklist (token_id, expires_at) VALUES (?, ?)`,
      [tokenId, expiresAt]
    );

    // Mark login record as revoked
    await db.query(
      `UPDATE ${tablePrefix}user_logins SET is_revoked = true WHERE token_id = ?`,
      [tokenId]
    );

    return true;
  } catch (error) {
    console.error('Error revoking token:', error);
    return false;
  }
};

const isTokenBlacklisted = async (tokenId) => {
  try {
    const [blacklisted] = await db.query(
      `SELECT 1 FROM ${tablePrefix}token_blacklist WHERE token_id = ? AND expires_at > NOW()`,
      [tokenId]
    );
    return blacklisted.length > 0;
  } catch (error) {
    console.error('Error checking blacklist:', error);
    return true; // Fail secure
  }
};

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    // Check blacklist
    if (await isTokenBlacklisted(decoded.jti)) {
      return res.status(401).json({ message: 'Token has been revoked' });
    }

    // Get user and login info
    const [users] = await db.query(`
      SELECT 
        u.*,
        ul.fingerprint,
        ul.ip_address,
        ul.is_revoked,
        u.is_agent
      FROM ${tablePrefix}users u
      LEFT JOIN ${tablePrefix}user_logins ul ON u.id = ul.user_id
      WHERE u.id = ? 
        AND ul.token_id = ?
        AND ul.expires_at > NOW()
        AND ul.is_revoked = false
      LIMIT 1
    `, [decoded.userId, decoded.jti]);

    if (!users.length) {
      return res.status(401).json({ message: 'Invalid token or session expired' });
    }

    const user = users[0];
    user.isAdmin = user.is_agent === 0;
    user.isAgent = user.is_agent === 1;

    if (user.isAgent && !user.isAdmin) {
      user.agentId = user.id;
    }

    // Verify fingerprint
    const currentFingerprint = generateFingerprint(req);
    if (user.fingerprint && user.fingerprint !== currentFingerprint) {
      await revokeToken(decoded.jti);
      return res.status(401).json({ message: 'Session mismatch' });
    }

    // Remove sensitive data
    delete user.password;
    delete user.fingerprint;
    delete user.ip_address;

    req.user = user;
    req.tokenId = decoded.jti;
    
    // Determine if user is admin or agent and add role information
    //await determineUserRole(req, res, next);
    next();
  } catch (error) {
    console.error('Auth error:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(401).json({ message: 'Invalid token' });
  }
};

const generateFingerprint = (req) => {
  const components = [
    req.headers['user-agent'] || '',
    req.headers['accept-language'] || '',
    req.ip || ''
  ];
  return crypto
    .createHash('sha256')
    .update(components.join(''))
    .digest('hex');
};

module.exports = {
  generateToken,
  authenticateToken,
  revokeToken,
  generateFingerprint
};