const { body, query, validationResult } = require('express-validator');
const { ALLOWED_CATEGORIES } = require('../models/Transaction');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((err) => err.msg);
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errorMessages
    });
  }
  next();
};

const registerValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 100 })
    .withMessage('Name must not exceed 100 characters'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  validate
];

const loginValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  validate
];

const transactionValidation = [
  body('type')
    .trim()
    .notEmpty()
    .withMessage('Transaction type is required')
    .isIn(['income', 'expense'])
    .withMessage('Type must be income or expense'),
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ gt: 0 })
    .withMessage('Amount must be a positive number greater than 0'),
  body('category')
    .trim()
    .notEmpty()
    .withMessage('Category is required')
    .isIn(ALLOWED_CATEGORIES)
    .withMessage(`Category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be a valid ISO 8601 date (e.g., YYYY-MM-DD)'),
  validate
];

const transactionUpdateValidation = [
  body('type')
    .optional()
    .trim()
    .isIn(['income', 'expense'])
    .withMessage('Type must be income or expense'),
  body('amount')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('Amount must be a positive number greater than 0'),
  body('category')
    .optional()
    .trim()
    .isIn(ALLOWED_CATEGORIES)
    .withMessage(`Category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be a valid ISO 8601 date'),
  validate
];

module.exports = {
  registerValidation,
  loginValidation,
  transactionValidation,
  transactionUpdateValidation
};
