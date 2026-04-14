/**
 * routes/expenses.js — Expense CRUD + analytics routes
 */

const express = require('express');
const { body, query } = require('express-validator');
const multer = require('multer');
const path = require('path');
const router = express.Router();

const {
  createExpense,
  getExpenses,
  getExpense,
  updateExpense,
  deleteExpense,
  previewCategorize,
  getMonthlySummary,
  getCategoryBreakdown,
} = require('../controllers/expenseController');
const { protect } = require('../middleware/auth');
const { CATEGORIES } = require('../models/Expense');

// Multer config for receipt uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `receipt-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|pdf/;
    const extname = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowed.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error('Only images and PDFs are allowed.'));
  },
});

// Expense validation
const expenseValidation = [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('description').trim().notEmpty().isLength({ max: 500 }),
  body('date').optional().isISO8601().toDate(),
  body('category').optional().isIn(CATEGORIES),
];

// Apply auth to all expense routes
router.use(protect);

// Analytics routes (must be before /:id)
router.get('/summary/monthly', getMonthlySummary);
router.get('/summary/categories', getCategoryBreakdown);
router.post('/categorize', previewCategorize);

// CRUD
router.post('/', upload.single('receipt'), expenseValidation, createExpense);
router.get('/', getExpenses);
router.get('/:id', getExpense);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);

module.exports = router;
