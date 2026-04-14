/**
 * services/api.js — Axios instance with JWT injection and error handling
 */

import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Global response error handler
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error.response?.data || error);
  }
);

// --- Auth ---
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/me', data),
  changePassword: (data) => api.put('/auth/change-password', data),
};

// --- Expenses ---
export const expenseAPI = {
  list: (params) => api.get('/expenses', { params }),
  get: (id) => api.get(`/expenses/${id}`),
  create: (data) => {
    // Handle FormData for receipt upload
    if (data instanceof FormData) {
      return api.post('/expenses', data, { headers: { 'Content-Type': 'multipart/form-data' } });
    }
    return api.post('/expenses', data);
  },
  update: (id, data) => api.put(`/expenses/${id}`, data),
  delete: (id) => api.delete(`/expenses/${id}`),
  categorize: (data) => api.post('/expenses/categorize', data),
  monthlySummary: (params) => api.get('/expenses/summary/monthly', { params }),
  categoryBreakdown: (params) => api.get('/expenses/summary/categories', { params }),
};

// --- Budgets ---
export const budgetAPI = {
  list: (params) => api.get('/budgets', { params }),
  create: (data) => api.post('/budgets', data),
  delete: (id) => api.delete(`/budgets/${id}`),
};

// --- Insights ---
export const insightAPI = {
  get: () => api.get('/insights'),
};

// --- Categories ---
export const categoryAPI = {
  list: () => api.get('/categories'),
};

export default api;
