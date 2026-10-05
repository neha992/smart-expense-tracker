const { Transaction } = require('../models/Transaction');

const createTransaction = async (req, res, next) => {
  try {
    const { type, amount, category, description, date } = req.body;

    const transaction = await Transaction.create({
      user: req.user._id,
      type,
      amount,
      category,
      description: description || '',
      date: date || Date.now()
    });

    return res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: transaction
    });
  } catch (error) {
    next(error);
  }
};

const getTransactions = async (req, res, next) => {
  try {
    const { category, type, startDate, endDate, page = 1, limit = 10 } = req.query;

    const queryFilter = { user: req.user._id };

    if (category) {
      queryFilter.category = category;
    }

    if (type) {
      queryFilter.type = type;
    }

    if (startDate || endDate) {
      queryFilter.date = {};
      if (startDate) {
        queryFilter.date.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        queryFilter.date.$lte = end;
      }
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const totalItems = await Transaction.countDocuments(queryFilter);
    const transactions = await Transaction.find(queryFilter)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const totalPages = Math.ceil(totalItems / limitNum) || 1;

    return res.status(200).json({
      success: true,
      count: transactions.length,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems,
        limit: limitNum
      },
      data: transactions
    });
  } catch (error) {
    next(error);
  }
};

const getTransactionById = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    if (transaction.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not own this transaction'
      });
    }

    return res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    next(error);
  }
};

const updateTransaction = async (req, res, next) => {
  try {
    let transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    if (transaction.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You cannot update another user\'s transaction'
      });
    }

    const { type, amount, category, description, date } = req.body;

    if (type !== undefined) transaction.type = type;
    if (amount !== undefined) transaction.amount = amount;
    if (category !== undefined) transaction.category = category;
    if (description !== undefined) transaction.description = description;
    if (date !== undefined) transaction.date = date;

    const updatedTransaction = await transaction.save();

    return res.status(200).json({
      success: true,
      message: 'Transaction updated successfully',
      data: updatedTransaction
    });
  } catch (error) {
    next(error);
  }
};

const deleteTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    if (transaction.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You cannot delete another user\'s transaction'
      });
    }

    await transaction.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'Transaction deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction
};
