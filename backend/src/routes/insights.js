/**
 * routes/insights.js — AI-powered spending insights
 */

const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const aiService = require('../utils/aiService');
const { protect } = require('../middleware/auth');

router.use(protect);

// GET /api/insights — AI spending insights + predictions
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const thisMonth = { $gte: new Date(now.getFullYear(), now.getMonth(), 1), $lte: now };
    const lastMonth = {
      $gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      $lte: new Date(now.getFullYear(), now.getMonth(), 0),
    };

    const [currentMonthData, lastMonthData, sixMonthHistory] = await Promise.all([
      Expense.aggregate([
        { $match: { user: userId, date: thisMonth } },
        { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Expense.aggregate([
        { $match: { user: userId, date: lastMonth } },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
      ]),
      Expense.aggregate([
        { $match: { user: userId, date: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) } } },
        { $group: { _id: { month: { $month: '$date' }, year: { $year: '$date' } }, total: { $sum: '$amount' } } },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
    ]);

    // Build insights locally (AI service adds richer ones)
    const insights = buildLocalInsights(currentMonthData, lastMonthData);

    // Get AI predictions
    const historicalData = sixMonthHistory.map(d => d.total);
    const prediction = await aiService.predictSpending(historicalData);

    res.json({ insights, prediction, currentMonthData, lastMonthData });
  } catch (error) { next(error); }
});

function buildLocalInsights(current, last) {
  const insights = [];
  const currentMap = Object.fromEntries(current.map(d => [d._id, d.total]));
  const lastMap = Object.fromEntries(last.map(d => [d._id, d.total]));

  Object.keys(currentMap).forEach(category => {
    const curr = currentMap[category];
    const prev = lastMap[category];
    if (prev) {
      const change = ((curr - prev) / prev) * 100;
      if (Math.abs(change) >= 10) {
        insights.push({
          type: change > 0 ? 'increase' : 'decrease',
          category,
          change: Math.round(change),
          message: `You spent ${Math.abs(Math.round(change))}% ${change > 0 ? 'more' : 'less'} on ${category} compared to last month.`,
        });
      }
    } else {
      insights.push({
        type: 'new',
        category,
        amount: curr,
        message: `New spending in ${category}: $${curr.toFixed(2)} this month.`,
      });
    }
  });

  return insights.slice(0, 5);
}

module.exports = router;
