// services/passwordService.js
const bcrypt = require('bcryptjs');

/**
 * Verify a password against a hash using Ion Auth compatible method
 * @param {string} password - Plain text password to verify
 * @param {string} hash - Stored password hash
 * @returns {Promise<boolean>} - Returns true if password matches
 */
async function verifyPassword(password, hash) {
  try {
    // First, try standard bcryptjs verification
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error('bcrypt verification error:', error);
    // If the standard verify fails, it might be a different format
    // Check if it starts with $ (bcrypt format)
    if (hash.startsWith('$')) {
      return false; // It's a bcrypt hash but invalid format
    }
    
    // Otherwise, it might be SHA1 format - implement SHA1 verification if needed
    // return verifyWithSha1(password, hash);
    
    return false;
  }
}

/**
 * Hash a password using Ion Auth compatible method
 * @param {string} password - Plain text password to hash
 * @returns {Promise<string>} - Returns hashed password
 */
async function hashPassword(password) {
  // Bcrypt rounds should match Ion Auth configuration
  const rounds = 8; // Your default_rounds value
  const salt = await bcrypt.genSalt(rounds);
  return await bcrypt.hash(password, salt);
}

// Optional: SHA1 verification if you have legacy passwords
function verifyWithSha1(password, hash) {
  // Implementation would depend on how your Ion Auth is configured for SHA1
  // This is just a placeholder for the concept
  const crypto = require('crypto');
  const parts = hash.split('$');
  
  if (parts.length === 2) {
    const salt = parts[0];
    const storedHash = parts[1];
    
    const calculatedHash = crypto
      .createHash('sha1')
      .update(salt + password)
      .digest('hex');
      
    return storedHash === calculatedHash;
  }
  
  return false;
}

module.exports = {
  verifyPassword,
  hashPassword
};