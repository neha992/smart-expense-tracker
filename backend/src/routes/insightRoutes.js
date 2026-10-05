const express = require('express');
const router = express.Router();
const {
  getAllInsights,
  getAnomalies,
  getForecast,
  getRecommendations
} = require('../controllers/insightController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', getAllInsights);
router.get('/anomalies', getAnomalies);
router.get('/forecast', getForecast);
router.get('/recommendations', getRecommendations);

module.exports = router;
