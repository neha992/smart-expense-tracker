const insightService = require('../services/insightService');

const getAllInsights = async (req, res, next) => {
  try {
    const insights = await insightService.getAllInsights(req.user._id);

    return res.status(200).json({
      success: true,
      data: insights
    });
  } catch (error) {
    next(error);
  }
};

const getAnomalies = async (req, res, next) => {
  try {
    const anomalies = await insightService.detectAnomalies(req.user._id);

    return res.status(200).json({
      success: true,
      data: anomalies
    });
  } catch (error) {
    next(error);
  }
};

const getForecast = async (req, res, next) => {
  try {
    const forecast = await insightService.calculateForecast(req.user._id);

    return res.status(200).json({
      success: true,
      data: forecast
    });
  } catch (error) {
    next(error);
  }
};

const getRecommendations = async (req, res, next) => {
  try {
    const recommendations = await insightService.generateRecommendations(req.user._id);

    return res.status(200).json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllInsights,
  getAnomalies,
  getForecast,
  getRecommendations
};
