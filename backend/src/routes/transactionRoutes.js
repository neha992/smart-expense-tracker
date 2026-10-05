const express = require('express');
const router = express.Router();
const {
  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction
} = require('../controllers/transactionController');
const { protect } = require('../middleware/authMiddleware');
const {
  transactionValidation,
  transactionUpdateValidation
} = require('../middleware/validationMiddleware');

router.use(protect);

router
  .route('/')
  .post(transactionValidation, createTransaction)
  .get(getTransactions);

router
  .route('/:id')
  .get(getTransactionById)
  .put(transactionUpdateValidation, updateTransaction)
  .delete(deleteTransaction);

module.exports = router;
