/**
 * tests/auth.test.js — Auth API endpoint tests
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');

const TEST_USER = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'SecurePass123!',
};

let token;
const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === 'true';
const describeIfIntegration = RUN_INTEGRATION ? describe : describe.skip;

jest.setTimeout(30000);

beforeAll(async () => {
  if (!RUN_INTEGRATION) return;
  const uri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/expense_tracker_test';
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  await User.deleteMany({ email: TEST_USER.email });
});

afterAll(async () => {
  if (!RUN_INTEGRATION) return;
  await User.deleteMany({ email: TEST_USER.email });
  await mongoose.connection.close();
});

describeIfIntegration('Auth Endpoints', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(TEST_USER)
        .expect(201);

      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toBe(TEST_USER.email);
      expect(res.body.user).not.toHaveProperty('password');
    });

    it('should reject duplicate email', async () => {
      await request(app)
        .post('/api/auth/register')
        .send(TEST_USER)
        .expect(409);
    });

    it('should reject weak password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...TEST_USER, email: 'new@test.com', password: '123' })
        .expect(400);
      expect(res.body).toHaveProperty('errors');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: TEST_USER.email, password: TEST_USER.password })
        .expect(200);

      expect(res.body).toHaveProperty('token');
      token = res.body.token;
    });

    it('should reject wrong password', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({ email: TEST_USER.email, password: 'wrongpassword' })
        .expect(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.user.email).toBe(TEST_USER.email);
    });

    it('should reject request without token', async () => {
      await request(app).get('/api/auth/me').expect(401);
    });
  });
});

describeIfIntegration('Expense Endpoints', () => {
  describe('POST /api/expenses', () => {
    it('should create expense with manual category', async () => {
      const res = await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 50.00,
          description: 'Lunch at café',
          category: 'Food & Dining',
          date: new Date().toISOString(),
        })
        .expect(201);

      expect(res.body.expense.amount).toBe(50.00);
      expect(res.body.expense.category).toBe('Food & Dining');
    });

    it('should reject expense without amount', async () => {
      const res = await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'Test', category: 'Other' })
        .expect(400);

      expect(res.body).toHaveProperty('errors');
    });
  });

  describe('GET /api/expenses', () => {
    it('should return paginated expenses', async () => {
      const res = await request(app)
        .get('/api/expenses?page=1&limit=10')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('expenses');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.expenses)).toBe(true);
    });
  });
});
