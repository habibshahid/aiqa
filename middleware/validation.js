// middleware/validation.js
const { body, validationResult } = require('express-validator');

// Login validation rules
const loginValidation = [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').trim().notEmpty().withMessage('Password is required')
];

// Contact validation rules
const contactValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').trim()
    .matches(/^\+?[\d\s-()]+$/)
    .withMessage('Invalid phone number format')
];

// Password change validation rules
const passwordChangeValidation = [
  body('currentPassword').trim().notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .trim()
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
];

// Validate request middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      message: 'Validation failed',
      errors: errors.array() 
    });
  }
  next();
};

module.exports = {
  loginValidation,
  contactValidation,
  passwordChangeValidation,
  validateRequest
};