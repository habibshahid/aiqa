// middleware/security.js
const helmet = require('helmet');
const xss = require('xss-clean');
const sanitize = require('express-mongo-sanitize');

// Combine all middleware into a single function
const securityMiddleware = (app) => {
  // Set security headers
  app.use(helmet());
  
  // Prevent XSS attacks
  app.use(xss());
  
  // Sanitize inputs
  app.use(sanitize());
  
  // Custom security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
};

module.exports = securityMiddleware;