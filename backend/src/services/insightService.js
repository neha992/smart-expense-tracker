const mongoose = require('mongoose');
const { Transaction } = require('../models/Transaction');

const detectAnomalies = async (userId) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const now = new Date();
  
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  
  const currentMonthStart = new Date(currentYear, currentMonth, 1);
  const currentMonthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

  const currentMonthCategoryStats = await Transaction.aggregate([
    {
      $match: {
        user: userObjectId,
        type: 'expense',
        date: { $gte: currentMonthStart, $lte: currentMonthEnd }
      }
    },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' }
      }
    }
  ]);

  const currentSpendingMap = {};
  currentMonthCategoryStats.forEach((item) => {
    currentSpendingMap[item._id] = item.total;
  });

  const historicalStats = await Transaction.aggregate([
    {
      $match: {
        user: userObjectId,
        type: 'expense',
        date: { $lt: currentMonthStart }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$date' },
          month: { $month: '$date' },
          category: '$category'
        },
        monthlyTotal: { $sum: '$amount' }
      }
    }
  ]);

  const categoryHistoricalTotals = {};
  const categoryHistoricalMonthsCount = {};

  historicalStats.forEach((item) => {
    const category = item._id.category;
    if (!categoryHistoricalTotals[category]) {
      categoryHistoricalTotals[category] = 0;
      categoryHistoricalMonthsCount[category] = 0;
    }
    categoryHistoricalTotals[category] += item.monthlyTotal;
    categoryHistoricalMonthsCount[category] += 1;
  });

  const anomalies = [];

  for (const [category, currentSpending] of Object.entries(currentSpendingMap)) {
    const historicalTotal = categoryHistoricalTotals[category] || 0;
    const monthsCount = categoryHistoricalMonthsCount[category] || 0;
    
    let historicalAverage = 0;
    if (monthsCount > 0) {
      historicalAverage = Math.round((historicalTotal / monthsCount) * 100) / 100;
    }

    let increasePercentage = 0;
    let isAnomaly = false;
    let message = `${category} spending is within your usual range.`;

    if (historicalAverage > 0) {
      increasePercentage = Math.round(((currentSpending - historicalAverage) / historicalAverage) * 10000) / 100;
      if (increasePercentage >= 30) {
        isAnomaly = true;
        message = `${category} spending is ${increasePercentage}% higher than your usual monthly average of ₹${historicalAverage}.`;
      }
    }
    // No-baseline case: historicalAverage is 0, so we cannot calculate a meaningful spike percentage.
    // increasePercentage stays 0 — a false 100% would be misleading.
    // isAnomaly and message will be resolved after finding the highest-spending category.

    anomalies.push({
      category,
      currentSpending: Math.round(currentSpending * 100) / 100,
      historicalAverage,
      increasePercentage,
      isAnomaly,
      message,
      _hasBaseline: historicalAverage > 0
    });
  }

  // Post-processing: handle the no-baseline case cleanly.
  // Find the highest-spending category among those without a historical baseline.
  const noBaselineEntries = anomalies.filter((a) => !a._hasBaseline);
  if (noBaselineEntries.length > 0) {
    // Sort descending by currentSpending to find the highest spender.
    noBaselineEntries.sort((a, b) => b.currentSpending - a.currentSpending);
    const highestNoBaseline = noBaselineEntries[0];

    anomalies.forEach((a) => {
      if (!a._hasBaseline) {
        if (a.category === highestNoBaseline.category) {
          // Flag the top spender with an initial alert.
          a.isAnomaly = true;
          a.message = `Initial spending alert: ${a.category} is currently your highest expense category at ₹${a.currentSpending}. More historical data is needed to detect a spending spike.`;
        } else {
          // All other no-baseline categories get a neutral informational message.
          a.isAnomaly = false;
          a.message = `${a.category} spending does not have enough historical data yet to determine a spending trend.`;
        }
      }
      // Remove internal helper field before returning.
      delete a._hasBaseline;
    });
  } else {
    // Remove helper field when all categories have a baseline.
    anomalies.forEach((a) => delete a._hasBaseline);
  }

  return anomalies;
};

const calculateForecast = async (userId) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const now = new Date();

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const currentMonthStart = new Date(currentYear, currentMonth, 1);
  const currentMonthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysElapsed = Math.max(1, now.getDate());

  const stats = await Transaction.aggregate([
    {
      $match: {
        user: userObjectId,
        type: 'expense',
        date: { $gte: currentMonthStart, $lte: currentMonthEnd }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]);

  const currentSpending = stats.length > 0 ? stats[0].total : 0;
  const dailyAverage = Math.round((currentSpending / daysElapsed) * 100) / 100;
  const projectedMonthlySpending = Math.round((dailyAverage * daysInMonth) * 100) / 100;

  return {
    currentSpending: Math.round(currentSpending * 100) / 100,
    daysElapsed,
    daysInMonth,
    dailyAverage,
    projectedMonthlySpending,
    message: currentSpending === 0
      ? 'No expenses recorded for the current month yet.'
      : `Based on your average spending of ₹${dailyAverage}/day over ${daysElapsed} days, your estimated monthly spending will be ₹${projectedMonthlySpending}.`
  };
};

const generateRecommendations = async (userId) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const now = new Date();

  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const monthStats = await Transaction.aggregate([
    {
      $match: {
        user: userObjectId,
        date: { $gte: currentMonthStart, $lte: currentMonthEnd }
      }
    },
    {
      $group: {
        _id: '$type',
        total: { $sum: '$amount' }
      }
    }
  ]);

  let currentIncome = 0;
  let currentExpenses = 0;

  monthStats.forEach((item) => {
    if (item._id === 'income') currentIncome = item.total;
    if (item._id === 'expense') currentExpenses = item.total;
  });

  const anomalies = await detectAnomalies(userId);
  const anomalyList = anomalies.filter((a) => a.isAnomaly);

  const categoryStats = await Transaction.aggregate([
    {
      $match: {
        user: userObjectId,
        type: 'expense',
        date: { $gte: currentMonthStart, $lte: currentMonthEnd }
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

  const recommendations = [];

  if (categoryStats.length > 0) {
    const highestCat = categoryStats[0];
    recommendations.push(
      `${highestCat._id} is your highest expense category this month at ₹${highestCat.total.toFixed(2)}.`
    );
  }

  if (anomalyList.length > 0) {
    anomalyList.forEach((anomaly) => {
      if (anomaly.historicalAverage > 0) {
        // Genuine historical spike — show the percentage increase.
        recommendations.push(
          `Alert: Your ${anomaly.category} spending has spiked by ${anomaly.increasePercentage}% compared to your baseline.`
        );
      } else {
        // No baseline — use the anomaly's own descriptive message to avoid misleading percentages.
        recommendations.push(`Alert: ${anomaly.message}`);
      }
    });
  } else if (categoryStats.length > 0) {
    recommendations.push('Your monthly category spending is stable and aligned with historical averages.');
  }

  if (currentIncome > 0) {
    const expenseRatio = (currentExpenses / currentIncome) * 100;
    if (expenseRatio > 100) {
      recommendations.push(
        `Warning: Your expenses (₹${currentExpenses.toFixed(2)}) exceed your monthly income (₹${currentIncome.toFixed(2)}). Consider curtailing non-essential expenses.`
      );
    } else if (expenseRatio > 80) {
      recommendations.push(
        `Budget Alert: You have spent ${expenseRatio.toFixed(1)}% of your monthly income. Aim to save at least 20% of your earnings.`
      );
    } else {
      const savingsRate = (100 - expenseRatio).toFixed(1);
      recommendations.push(
        `Great job! You are maintaining a healthy savings rate of ${savingsRate}% this month.`
      );
    }
  } else if (currentExpenses > 0) {
    recommendations.push(
      'No income recorded for this month yet. Ensure all earnings are logged to maintain an accurate budget balance.'
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      'Add more income and expense transactions to unlock tailored financial recommendations and smart insights.'
    );
  }

  return { recommendations };
};

const getAllInsights = async (userId) => {
  const anomalies = await detectAnomalies(userId);
  const forecast = await calculateForecast(userId);
  const recommendationsObj = await generateRecommendations(userId);

  return {
    anomalies,
    forecast,
    recommendations: recommendationsObj.recommendations
  };
};

module.exports = {
  detectAnomalies,
  calculateForecast,
  generateRecommendations,
  getAllInsights
};
