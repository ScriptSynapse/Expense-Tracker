/**
 * routes/auth.js — Authentication routes
 */

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const { register, login, getMe, updateProfile, changePassword } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Validation rules
const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.get('/me', protect, getMe);
router.put('/me', protect, updateProfile);
router.put('/change-password', protect, changePassword);

module.exports = router;
