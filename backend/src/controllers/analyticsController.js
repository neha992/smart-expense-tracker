const analyticsService = require('../services/analyticsService');

const getSummary = async (req, res, next) => {
  try {
    const summary = await analyticsService.getSummary(req.user._id);

    return res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
};

const getMonthlyAnalytics = async (req, res, next) => {
  try {
    const { year, month } = req.query;
    const monthlyData = await analyticsService.getMonthlyAnalytics(req.user._id, year, month);

    return res.status(200).json({
      success: true,
      data: monthlyData
    });
  } catch (error) {
    next(error);
  }
};

const getCategoryAnalytics = async (req, res, next) => {
  try {
    const { type = 'expense' } = req.query;
    const categoryData = await analyticsService.getCategoryAnalytics(req.user._id, type);

    return res.status(200).json({
      success: true,
      data: categoryData
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSummary,
  getMonthlyAnalytics,
  getCategoryAnalytics
};
