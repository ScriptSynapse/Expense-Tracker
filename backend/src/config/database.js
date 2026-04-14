/**
 * config/database.js — MongoDB connection via Mongoose
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/expense_tracker';

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info(`MongoDB connected: ${conn.connection.host}`);

    // Handle connection events
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting reconnect...');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

  } catch (error) {
    logger.error('MongoDB connection failed:', error.message);
    throw error;
  }
};

module.exports = connectDB;
