import api from './api';

export const authService = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

export const transactionService = {
  getAll: (params) => api.get('/transactions', { params }),
  getById: (id) => api.get(`/transactions/${id}`),
  create: (data) => api.post('/transactions', data),
  update: (id, data) => api.put(`/transactions/${id}`, data),
  remove: (id) => api.delete(`/transactions/${id}`),
};

export const analyticsService = {
  getSummary: () => api.get('/analytics/summary'),
  getMonthly: (params) => api.get('/analytics/monthly', { params }),
  getCategories: (params) => api.get('/analytics/categories', { params }),
};

export const insightService = {
  getAll: () => api.get('/insights'),
  getAnomalies: () => api.get('/insights/anomalies'),
  getForecast: () => api.get('/insights/forecast'),
  getRecommendations: () => api.get('/insights/recommendations'),
};

export const healthService = {
  check: () => api.get('/health'),
};
