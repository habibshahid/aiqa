// middleware/systemAuth.js
const jwt = require('jsonwebtoken');

/**
 * Authentication middleware that allows both JWT token and system internal API token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticateTokenWithSystemAccess = (req, res, next) => {
  // Get authorization header
  const authHeader = req.headers['authorization'];
  
  // Check for system API token first
  const systemToken = process.env.SYSTEM_API_TOKEN || 'internal-system-token';
  if (authHeader === `Bearer ${systemToken}`) {
    // For system calls, create a system user context
    req.user = {
      id: 'system',
      username: 'System',
      roles: ['system'],
      permissions: {
        'qa-forms': { read: true, write: true }
      }
    };
    return next();
  }
  
  // Fall back to standard JWT token validation
  if (!authHeader) {
    return res.status(401).json({ message: 'No authorization header provided' });
  }
  
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  try {
    const secret = process.env.JWT_SECRET || 'your-secret-key';
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

module.exports = {
  authenticateTokenWithSystemAccess
};