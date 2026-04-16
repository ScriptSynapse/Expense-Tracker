const logger = require('../utils/logger');
const errorHandler = require('../middleware/errorHandler');

jest.mock('../utils/logger', () => ({ error: jest.fn() }));

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('middleware/errorHandler', () => {
  const req = { originalUrl: '/api/test', method: 'GET' };
  const next = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.NODE_ENV;
  });

  it('returns default 500 response and logs server errors', () => {
    const err = new Error('something failed');
    const res = createRes();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'something failed' });
    expect(logger.error).toHaveBeenCalledWith('[500] something failed', {
      stack: err.stack,
      url: '/api/test',
      method: 'GET',
    });
  });

  it('maps mongoose validation errors to 400', () => {
    const err = {
      name: 'ValidationError',
      errors: {
        amount: { message: 'Amount is required' },
        category: { message: 'Category is required' },
      },
    };
    const res = createRes();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Amount is required, Category is required' });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('maps duplicate key errors to 409', () => {
    const err = { code: 11000, keyValue: { email: 'test@example.com' } };
    const res = createRes();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'email already exists.' });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('maps cast errors to 400', () => {
    const err = { name: 'CastError', path: '_id', value: 'invalid-id' };
    const res = createRes();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid _id: invalid-id' });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('includes stack trace in development mode', () => {
    process.env.NODE_ENV = 'development';
    const err = new Error('dev failure');
    const res = createRes();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'dev failure',
        stack: err.stack,
      })
    );
  });
});
