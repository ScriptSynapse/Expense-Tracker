/**
 * utils/aiService.js — HTTP client for the Python FastAPI AI microservice
 */

const axios = require('axios');
const logger = require('./logger');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_TIMEOUT_MS = 5000; // 5 second timeout

const aiClient = axios.create({
  baseURL: AI_SERVICE_URL,
  timeout: AI_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.AI_SERVICE_KEY || 'internal-key',
  },
});

/**
 * Categorize an expense description using the AI microservice
 * @param {string} description - Expense description text
 * @param {number} amount - Expense amount
 * @returns {{ category: string, confidence: number, alternatives: Array }}
 */
const categorize = async (description, amount) => {
  const response = await aiClient.post('/categorize', { description, amount });
  return response.data;
};

/**
 * Get AI-generated spending insights
 * @param {Object} data - Spending data for analysis
 * @returns {{ insights: Array, predictions: Object }}
 */
const getInsights = async (data) => {
  try {
    const response = await aiClient.post('/insights', data);
    return response.data;
  } catch (error) {
    logger.warn('AI insights failed:', error.message);
    return { insights: [], predictions: {} };
  }
};

/**
 * Submit user correction feedback for model retraining
 * @param {Object} feedback - { description, amount, predicted, correct }
 */
const submitFeedback = async (feedback) => {
  const response = await aiClient.post('/feedback', feedback);
  return response.data;
};

/**
 * Predict next month's spending
 * @param {Array} historicalData - Array of monthly totals
 */
const predictSpending = async (historicalData) => {
  try {
    const response = await aiClient.post('/predict', { historicalData });
    return response.data;
  } catch (error) {
    logger.warn('AI prediction failed:', error.message);
    return null;
  }
};

module.exports = { categorize, getInsights, submitFeedback, predictSpending };
