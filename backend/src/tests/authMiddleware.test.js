const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');
const { protect } = require('../middleware/auth');

jest.mock('jsonwebtoken');
jest.mock('../models/User');
jest.mock('../utils/logger', () => ({ error: jest.fn() }));

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('middleware/auth protect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  it('returns 401 when authorization header is missing', async () => {
    const req = { headers: {} };
    const res = createRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Access denied. No token provided.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is expired', async () => {
    const req = { headers: { authorization: 'Bearer expired-token' } };
    const res = createRes();
    const next = jest.fn();

    jwt.verify.mockImplementation(() => {
      const err = new Error('expired');
      err.name = 'TokenExpiredError';
      throw err;
    });

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token expired. Please login again.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is invalid', async () => {
    const req = { headers: { authorization: 'Bearer invalid-token' } };
    const res = createRes();
    const next = jest.fn();

    jwt.verify.mockImplementation(() => {
      const err = new Error('invalid');
      err.name = 'JsonWebTokenError';
      throw err;
    });

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when decoded user is not found', async () => {
    const req = { headers: { authorization: 'Bearer valid-token' } };
    const res = createRes();
    const next = jest.fn();

    jwt.verify.mockReturnValue({ id: 'user-id' });
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token invalid. User not found.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches user and calls next on valid token', async () => {
    const req = { headers: { authorization: 'Bearer valid-token' } };
    const res = createRes();
    const next = jest.fn();
    const user = { _id: 'user-id', email: 'test@example.com' };
    const select = jest.fn().mockResolvedValue(user);

    jwt.verify.mockReturnValue({ id: 'user-id' });
    User.findById.mockReturnValue({ select });

    await protect(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
    expect(User.findById).toHaveBeenCalledWith('user-id');
    expect(select).toHaveBeenCalledWith('-password');
    expect(req.user).toEqual(user);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 500 and logs unexpected errors', async () => {
    const req = { headers: { authorization: 'Bearer broken-token' } };
    const res = createRes();
    const next = jest.fn();
    const err = new Error('boom');

    jwt.verify.mockImplementation(() => {
      throw err;
    });

    await protect(req, res, next);

    expect(logger.error).toHaveBeenCalledWith('Auth middleware error:', err);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error.' });
    expect(next).not.toHaveBeenCalled();
  });
});
