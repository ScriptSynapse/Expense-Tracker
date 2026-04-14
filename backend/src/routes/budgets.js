/**
 * routes/budgets.js
 */

const express = require('express');
const router = express.Router();
const Budget = require('../models/Budget');
const Expense = require('../models/Expense');
const { protect } = require('../middleware/auth');

router.use(protect);

// GET /api/budgets?month=&year=
router.get('/', async (req, res, next) => {
  try {
    const { month = new Date().getMonth() + 1, year = new Date().getFullYear() } = req.query;
    const budgets = await Budget.find({ user: req.user._id, month: parseInt(month), year: parseInt(year) });

    // Attach current spending to each budget
    const budgetsWithSpending = await Promise.all(budgets.map(async (budget) => {
      const startDate = new Date(budget.year, budget.month - 1, 1);
      const endDate = new Date(budget.year, budget.month, 0);

      const spent = await Expense.aggregate([
        { $match: { user: req.user._id, category: budget.category, date: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);

      return {
        ...budget.toObject(),
        spent: spent[0]?.total || 0,
        remaining: budget.amount - (spent[0]?.total || 0),
        percentage: ((spent[0]?.total || 0) / budget.amount) * 100,
      };
    }));

    res.json({ budgets: budgetsWithSpending });
  } catch (error) { next(error); }
});

// POST /api/budgets
router.post('/', async (req, res, next) => {
  try {
    const { category, amount, month, year, alertThreshold } = req.body;
    const budget = await Budget.findOneAndUpdate(
      { user: req.user._id, category, month, year },
      { amount, alertThreshold: alertThreshold || 80, alertSent: false },
      { upsert: true, new: true, runValidators: true }
    );
    res.status(201).json({ budget });
  } catch (error) { next(error); }
});

// DELETE /api/budgets/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await Budget.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.json({ message: 'Budget deleted.' });
  } catch (error) { next(error); }
});

module.exports = router;
