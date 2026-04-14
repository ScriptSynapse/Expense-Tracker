/**
 * routes/categories.js — Expense categories list
 */

const express = require('express');
const router = express.Router();
const { CATEGORIES } = require('../models/Expense');
const { protect } = require('../middleware/auth');

router.get('/', protect, (req, res) => {
  res.json({ categories: CATEGORIES });
});

module.exports = router;
