/**
 * models/Budget.js — Monthly budget per category
 */

const mongoose = require('mongoose');
const { CATEGORIES } = require('./Expense');

const budgetSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  category: {
    type: String,
    enum: CATEGORIES,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: [1, 'Budget must be at least 1'],
  },
  currency: {
    type: String,
    default: 'USD',
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12,
  },
  year: {
    type: Number,
    required: true,
  },
  alertThreshold: {
    type: Number,
    default: 80, // Alert at 80% of budget
    min: 1,
    max: 100,
  },
  alertSent: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Unique constraint: one budget per user/category/month/year
budgetSchema.index({ user: 1, category: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Budget', budgetSchema);
