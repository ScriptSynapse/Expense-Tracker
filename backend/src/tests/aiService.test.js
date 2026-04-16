const axios = require('axios');
const logger = require('../utils/logger');

jest.mock('axios');
jest.mock('../utils/logger', () => ({ warn: jest.fn() }));

describe('utils/aiService', () => {
  let post;
  let aiService;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    post = jest.fn();
    axios.create.mockReturnValue({ post });
    aiService = require('../utils/aiService');
  });

  it('categorize sends request and returns response data', async () => {
    post.mockResolvedValue({ data: { category: 'Transport', confidence: 0.9 } });

    const result = await aiService.categorize('Uber ride', 250);

    expect(post).toHaveBeenCalledWith('/categorize', { description: 'Uber ride', amount: 250 });
    expect(result).toEqual({ category: 'Transport', confidence: 0.9 });
  });

  it('getInsights returns response data when AI service succeeds', async () => {
    post.mockResolvedValue({ data: { insights: ['Test'], predictions: { trend: 'stable' } } });

    const result = await aiService.getInsights({ monthlyTotals: [100, 120] });

    expect(post).toHaveBeenCalledWith('/insights', { monthlyTotals: [100, 120] });
    expect(result).toEqual({ insights: ['Test'], predictions: { trend: 'stable' } });
  });

  it('getInsights falls back when AI service fails', async () => {
    post.mockRejectedValue(new Error('timeout'));

    const result = await aiService.getInsights({ monthlyTotals: [] });

    expect(logger.warn).toHaveBeenCalledWith('AI insights failed:', 'timeout');
    expect(result).toEqual({ insights: [], predictions: {} });
  });

  it('submitFeedback sends request and returns response data', async () => {
    const payload = { description: 'Gym', amount: 50, predicted: 'Other', correct: 'Sports & Fitness' };
    post.mockResolvedValue({ data: { success: true } });

    const result = await aiService.submitFeedback(payload);

    expect(post).toHaveBeenCalledWith('/feedback', payload);
    expect(result).toEqual({ success: true });
  });

  it('predictSpending returns response data when AI service succeeds', async () => {
    post.mockResolvedValue({ data: { predicted: 1200, trend: 'increasing' } });

    const result = await aiService.predictSpending([1000, 1100]);

    expect(post).toHaveBeenCalledWith('/predict', { historicalData: [1000, 1100] });
    expect(result).toEqual({ predicted: 1200, trend: 'increasing' });
  });

  it('predictSpending returns null when AI service fails', async () => {
    post.mockRejectedValue(new Error('service unavailable'));

    const result = await aiService.predictSpending([1000]);

    expect(logger.warn).toHaveBeenCalledWith('AI prediction failed:', 'service unavailable');
    expect(result).toBeNull();
  });
});
