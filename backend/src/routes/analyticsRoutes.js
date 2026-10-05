const express = require('express');
const router = express.Router();
const {
  getSummary,
  getMonthlyAnalytics,
  getCategoryAnalytics
} = require('../controllers/analyticsController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/summary', getSummary);
router.get('/monthly', getMonthlyAnalytics);
router.get('/categories', getCategoryAnalytics);

module.exports = router;
