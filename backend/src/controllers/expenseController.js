/**
 * controllers/expenseController.js — Full CRUD + AI categorization
 */

const { validationResult } = require('express-validator');
const Expense = require('../models/Expense');
const Budget = require('../models/Budget');
const aiService = require('../utils/aiService');
const logger = require('../utils/logger');

/**
 * POST /api/expenses
 * Create expense, auto-categorize with AI if category not provided
 */
const createExpense = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, description, date, category, notes, tags, isRecurring, currency } = req.body;

    let finalCategory = category;
    let aiCategory = null;
    let aiConfidence = null;
    let categorySource = 'manual';

    // If no category provided, use AI to categorize
    if (!category) {
      try {
        const aiResult = await aiService.categorize(description, amount);
        aiCategory = aiResult.category;
        aiConfidence = aiResult.confidence;
        finalCategory = aiResult.category;
        categorySource = 'ai';
      } catch (aiError) {
        logger.warn('AI categorization failed, defaulting to Other:', aiError.message);
        finalCategory = 'Other';
      }
    }

    // Handle receipt upload
    let receipt = null;
    if (req.file) {
      receipt = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: `/uploads/${req.file.filename}`,
      };
    }

    const expense = await Expense.create({
      user: req.user._id,
      amount,
      currency: currency || req.user.preferences?.currency || 'USD',
      description,
      date: date || new Date(),
      category: finalCategory,
      aiCategory,
      aiConfidence,
      categorySource,
      notes,
      tags: tags || [],
      isRecurring: isRecurring || false,
      receipt,
    });

    // Check budget alerts
    await checkBudgetAlert(req.user._id, finalCategory, expense.date);

    res.status(201).json({ expense });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/expenses
 * List expenses with pagination, filtering, sorting
 */
const getExpenses = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      startDate,
      endDate,
      search,
      sortBy = 'date',
      sortOrder = 'desc',
      minAmount,
      maxAmount,
    } = req.query;

    const filter = { user: req.user._id };

    if (category) filter.category = category;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }
    if (search) {
      filter.$or = [
        { description: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }
    if (minAmount || maxAmount) {
      filter.amount = {};
      if (minAmount) filter.amount.$gte = parseFloat(minAmount);
      if (maxAmount) filter.amount.$lte = parseFloat(maxAmount);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortDir = sortOrder === 'asc' ? 1 : -1;

    const [expenses, total] = await Promise.all([
      Expense.find(filter)
        .sort({ [sortBy]: sortDir })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Expense.countDocuments(filter),
    ]);

    res.json({
      expenses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/expenses/:id
 */
const getExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, user: req.user._id });
    if (!expense) return res.status(404).json({ error: 'Expense not found.' });
    res.json({ expense });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/expenses/:id
 * Update expense — if category changed by user, record feedback for model retraining
 */
const updateExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, user: req.user._id });
    if (!expense) return res.status(404).json({ error: 'Expense not found.' });

    const { category, ...updateFields } = req.body;

    // Track category correction for AI feedback loop
    if (category && category !== expense.category) {
      updateFields.category = category;
      updateFields.categorySource = 'corrected';
      updateFields.userFeedback = {
        correctedFrom: expense.category,
        correctedAt: new Date(),
      };
      // Submit feedback to AI service for retraining dataset
      aiService.submitFeedback({
        description: expense.description,
        amount: expense.amount,
        predicted: expense.aiCategory,
        correct: category,
      }).catch(err => logger.warn('AI feedback submission failed:', err.message));
    } else if (category) {
      updateFields.category = category;
    }

    const updated = await Expense.findByIdAndUpdate(
      expense._id,
      updateFields,
      { new: true, runValidators: true }
    );

    res.json({ expense: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/expenses/:id
 */
const deleteExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!expense) return res.status(404).json({ error: 'Expense not found.' });
    res.json({ message: 'Expense deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/expenses/categorize
 * Preview AI categorization without creating expense
 */
const previewCategorize = async (req, res, next) => {
  try {
    const { description, amount } = req.body;
    const result = await aiService.categorize(description, amount);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/expenses/summary/monthly
 * Monthly summary aggregation
 */
const getMonthlySummary = async (req, res, next) => {
  try {
    const { year = new Date().getFullYear(), month } = req.query;

    const matchFilter = { user: req.user._id };
    if (month) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      matchFilter.date = { $gte: startDate, $lte: endDate };
    } else {
      matchFilter.date = {
        $gte: new Date(year, 0, 1),
        $lte: new Date(year, 11, 31, 23, 59, 59),
      };
    }

    const summary = await Expense.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: {
            month: { $month: '$date' },
            year: { $year: '$date' },
            category: '$category',
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    res.json({ summary });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/expenses/summary/categories
 * Category breakdown for a given period
 */
const getCategoryBreakdown = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const matchFilter = {
      user: req.user._id,
      date: {
        $gte: startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        $lte: endDate ? new Date(endDate) : new Date(),
      },
    };

    const breakdown = await Expense.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' },
        },
      },
      { $sort: { total: -1 } },
    ]);

    const totalSpending = breakdown.reduce((sum, item) => sum + item.total, 0);

    const result = breakdown.map(item => ({
      category: item._id,
      total: item.total,
      count: item.count,
      avgAmount: item.avgAmount,
      percentage: totalSpending > 0 ? (item.total / totalSpending) * 100 : 0,
    }));

    res.json({ breakdown: result, totalSpending });
  } catch (error) {
    next(error);
  }
};

// Helper: check if budget threshold reached and fire alert
const checkBudgetAlert = async (userId, category, date) => {
  try {
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    const budget = await Budget.findOne({ user: userId, category, month, year });
    if (!budget || budget.alertSent) return;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const spent = await Expense.aggregate([
      { $match: { user: userId, category, date: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const totalSpent = spent[0]?.total || 0;
    const percentage = (totalSpent / budget.amount) * 100;

    if (percentage >= budget.alertThreshold) {
      budget.alertSent = true;
      await budget.save();
      logger.info(`Budget alert: ${category} at ${percentage.toFixed(1)}% for user ${userId}`);
      // In production: emit socket event or send push notification
    }
  } catch (err) {
    logger.warn('Budget check failed:', err.message);
  }
};

module.exports = {
  createExpense,
  getExpenses,
  getExpense,
  updateExpense,
  deleteExpense,
  previewCategorize,
  getMonthlySummary,
  getCategoryBreakdown,
};
