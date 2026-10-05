const mongoose = require('mongoose');
const { Transaction } = require('../models/Transaction');

const getSummary = async (userId) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const stats = await Transaction.aggregate([
    { $match: { user: userObjectId } },
    {
      $group: {
        _id: '$type',
        total: { $sum: '$amount' }
      }
    }
  ]);

  let totalIncome = 0;
  let totalExpenses = 0;

  stats.forEach((item) => {
    if (item._id === 'income') {
      totalIncome = item.total;
    } else if (item._id === 'expense') {
      totalExpenses = item.total;
    }
  });

  const balance = totalIncome - totalExpenses;

  return {
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    balance: Math.round(balance * 100) / 100
  };
};

const getMonthlyAnalytics = async (userId, targetYear, targetMonth) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const now = new Date();

  const year = targetYear ? parseInt(targetYear, 10) : now.getFullYear();
  const month = targetMonth ? parseInt(targetMonth, 10) : now.getMonth() + 1;

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const monthlyStats = await Transaction.aggregate([
    {
      $match: {
        user: userObjectId,
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$type',
        total: { $sum: '$amount' }
      }
    }
  ]);

  let income = 0;
  let expenses = 0;

  monthlyStats.forEach((item) => {
    if (item._id === 'income') {
      income = item.total;
    } else if (item._id === 'expense') {
      expenses = item.total;
    }
  });

  const balance = income - expenses;

  const sixMonthsAgo = new Date(year, month - 6, 1);
  const trends = await Transaction.aggregate([
    {
      $match: {
        user: userObjectId,
        date: { $gte: sixMonthsAgo, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$date' },
          month: { $month: '$date' },
          type: '$type'
        },
        total: { $sum: '$amount' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const monthFormatted = `${monthNames[month - 1]} ${year}`;

  return {
    month: monthFormatted,
    income: Math.round(income * 100) / 100,
    expenses: Math.round(expenses * 100) / 100,
    balance: Math.round(balance * 100) / 100,
    spendingTrend: trends.map((t) => ({
      year: t._id.year,
      month: monthNames[t._id.month - 1],
      type: t._id.type,
      total: Math.round(t.total * 100) / 100
    }))
  };
};

const getCategoryAnalytics = async (userId, type = 'expense') => {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const stats = await Transaction.aggregate([
    {
      $match: {
        user: userObjectId,
        type: type
      }
    },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' }
      }
    },
    { $sort: { total: -1 } }
  ]);

  const result = {};
  stats.forEach((item) => {
    result[item._id] = Math.round(item.total * 100) / 100;
  });

  return result;
};

module.exports = {
  getSummary,
  getMonthlyAnalytics,
  getCategoryAnalytics
};
