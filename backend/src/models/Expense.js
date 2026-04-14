/**
 * models/Expense.js — Expense schema with AI categorization support
 */

const mongoose = require('mongoose');

const CATEGORIES = [
  'Food & Dining',
  'Transport',
  'Shopping',
  'Entertainment',
  'Bills & Utilities',
  'Health & Medical',
  'Travel',
  'Education',
  'Housing',
  'Personal Care',
  'Sports & Fitness',
  'Gifts & Donations',
  'Investments',
  'Other',
];

const expenseSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be greater than 0'],
  },
  currency: {
    type: String,
    default: 'USD',
    uppercase: true,
    maxlength: 3,
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
    default: Date.now,
  },
  category: {
    type: String,
    enum: CATEGORIES,
    required: true,
  },
  // AI categorization metadata
  aiCategory: {
    type: String,
    enum: CATEGORIES,
  },
  aiConfidence: {
    type: Number,
    min: 0,
    max: 1,
  },
  categorySource: {
    type: String,
    enum: ['ai', 'manual', 'corrected'], // 'corrected' = user overrode AI
    default: 'manual',
  },
  // User feedback for model retraining
  userFeedback: {
    correctedFrom: { type: String, enum: [...CATEGORIES, null] },
    correctedAt: { type: Date },
  },
  // Receipt image
  receipt: {
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    url: String,
  },
  notes: {
    type: String,
    maxlength: 1000,
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 50,
  }],
  isRecurring: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// --- Compound indexes for common queries ---
expenseSchema.index({ user: 1, date: -1 });
expenseSchema.index({ user: 1, category: 1, date: -1 });
expenseSchema.index({ user: 1, createdAt: -1 });

// --- Virtual: formatted amount ---
expenseSchema.virtual('formattedAmount').get(function () {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: this.currency,
  }).format(this.amount);
});

// --- Static: get categories list ---
expenseSchema.statics.getCategories = () => CATEGORIES;

module.exports = mongoose.model('Expense', expenseSchema);
module.exports.CATEGORIES = CATEGORIES;
