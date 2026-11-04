const mongoose = require("mongoose");

const ALLOWED_CATEGORIES = [
  "Food",
  "Travel",
  "Shopping",
  "Bills",
  "Education",
  "Healthcare",
  "Salary",
  "Other"
];

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true
    },

    type: {
      type: String,
      required: [true, "Transaction type is required"],
      enum: {
        values: ["income", "expense"],
        message: "Type must be either income or expense"
      }
    },

    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0.01, "Amount must be greater than 0"]
    },

    category: {
      type: String,
      required: [true, "Category is required"],
      enum: {
        values: ALLOWED_CATEGORIES,
        message:
          "Category must be one of: " +
          ALLOWED_CATEGORIES.join(", ")
      }
    },

    description: {
      type: String,
      trim: true,
      default: ""
    },

    receiptFingerprint: {
      type: String,
      trim: true,
      lowercase: true,
      match: /^[a-f0-9]{64}$/i
    },

    date: {
      type: Date,
      required: [true, "Transaction date is required"],
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

transactionSchema.index({
  user: 1,
  date: -1
});

transactionSchema.index({
  user: 1,
  type: 1,
  category: 1
});

// Prevent the same analyzed receipt image being saved twice for one user.
// Existing transactions without a fingerprint are unaffected.
transactionSchema.index(
  {
    user: 1,
    receiptFingerprint: 1
  },
  {
    unique: true,
    partialFilterExpression: {
      receiptFingerprint: { $type: "string" }
    }
  }
);

const Transaction = mongoose.model(
  "Transaction",
  transactionSchema
);

module.exports = {
  Transaction,
  ALLOWED_CATEGORIES
};
