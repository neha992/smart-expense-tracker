const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const authRoutes = require('./routes/authRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const insightRoutes = require('./routes/insightRoutes');

const app = express();

const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:3001'
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

app.use(express.json());

app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  return res.status(200).json({
    status: 'healthy',
    message: 'Expense Tracker API is running',
    timestamp: new Date().toISOString(),
    database: dbStatusMap[dbState] || 'unknown'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/insights', insightRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
