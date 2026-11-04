const crypto = require("crypto");
const receiptService = require("../services/receiptService");

const {
  Transaction,
  ALLOWED_CATEGORIES
} = require("../models/Transaction");

const analyzeReceipt = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Receipt image is required."
      });
    }

    const result = await receiptService.analyzeReceipt(req.file);

    if (!result.rawText || !result.rawText.trim()) {
      return res.status(422).json({
        success: false,
        message: result.message,
        receipt: result
      });
    }

    // Fingerprint the original image bytes.
    // Identical image files produce identical fingerprints.
    result.receiptFingerprint = crypto
      .createHash("sha256")
      .update(req.file.buffer)
      .digest("hex");

    return res.status(200).json({
      success: true,
      message: result.message,
      receipt: result
    });
  } catch (error) {
    next(error);
  }
};

const saveReceipt = async (req, res, next) => {
  try {
    const {
      merchant,
      amount,
      date,
      category,
      receiptFingerprint
    } = req.body;

    // Require the fingerprint produced by receipt analysis.
    if (
      typeof receiptFingerprint !== "string" ||
      !/^[a-f0-9]{64}$/i.test(receiptFingerprint)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "A valid receipt fingerprint from receipt analysis is required."
      });
    }

    const fingerprint = receiptFingerprint.toLowerCase();

    // Validate merchant.
    if (
      typeof merchant !== "string" ||
      !merchant.trim() ||
      merchant.trim().length > 150
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Enter a valid merchant name of at most 150 characters."
      });
    }

    // Validate amount.
    const parsedAmount =
      typeof amount === "number" || typeof amount === "string"
        ? Number(amount)
        : NaN;

    if (
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0 ||
      parsedAmount > 100000000
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Amount must be greater than 0 and must not exceed 100000000."
      });
    }

    // Validate category against the transaction model.
    if (
      typeof category !== "string" ||
      !ALLOWED_CATEGORIES.includes(category)
    ) {
      return res.status(400).json({
        success: false,
        message: "Choose a valid category.",
        allowedCategories: ALLOWED_CATEGORIES
      });
    }

    // Require a real calendar date in YYYY-MM-DD format.
    if (
      typeof date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
      return res.status(400).json({
        success: false,
        message: "Date must use YYYY-MM-DD format."
      });
    }

    const [year, month, day] = date.split("-").map(Number);

    const parsedDate = new Date(
      Date.UTC(year, month - 1, day)
    );

    const validDate =
      parsedDate.getUTCFullYear() === year &&
      parsedDate.getUTCMonth() === month - 1 &&
      parsedDate.getUTCDate() === day;

    if (!validDate) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid calendar date."
      });
    }

    // Only check transactions belonging to the authenticated user.
    const existingReceipt = await Transaction.findOne({
      user: req.user._id,
      receiptFingerprint: fingerprint
    });

    if (existingReceipt) {
      return res.status(409).json({
        success: false,
        duplicate: true,
        message: "This receipt has already been saved.",
        data: existingReceipt
      });
    }

    // Create the expense. The database unique index also protects
    // against two identical save requests arriving simultaneously.
    const transaction = await Transaction.create({
      user: req.user._id,
      type: "expense",
      amount: Math.round(parsedAmount * 100) / 100,
      category,
      description: `Receipt purchase: ${merchant.trim()}`,
      date: parsedDate,
      receiptFingerprint: fingerprint
    });

    return res.status(201).json({
      success: true,
      message: "Receipt saved as an expense transaction.",
      data: transaction
    });
  } catch (error) {
    // MongoDB duplicate-key error from the unique index.
    if (
      error &&
      error.code === 11000 &&
      error.keyPattern &&
      error.keyPattern.receiptFingerprint
    ) {
      return res.status(409).json({
        success: false,
        duplicate: true,
        message: "This receipt has already been saved."
      });
    }

    next(error);
  }
};

module.exports = {
  analyzeReceipt,
  saveReceipt
};
