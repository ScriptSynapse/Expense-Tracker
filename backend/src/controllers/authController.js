/**
 * controllers/authController.js — User registration, login, profile management
 */

const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const logger = require('../utils/logger');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

/**
 * POST /api/auth/register
 * Register a new user
 */
const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    const user = await User.create({ name, email, password });
    const token = generateToken(user._id);

    logger.info(`New user registered: ${email}`);

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login
 * Authenticate user and return JWT
 */
const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Fetch user with password (select: false by default)
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);

    res.json({
      message: 'Login successful',
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 * Get current user profile
 */
const getMe = async (req, res) => {
  res.json({ user: req.user });
};

/**
 * PUT /api/auth/me
 * Update profile (name, preferences)
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, preferences } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, preferences },
      { new: true, runValidators: true }
    );
    res.json({ user });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/auth/change-password
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe, updateProfile, changePassword };
