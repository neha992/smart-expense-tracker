const express = require("express");
const multer = require("multer");

const { protect } = require("../middleware/authMiddleware");

const {
  analyzeReceipt,
  saveReceipt
} = require("../controllers/receiptController");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  },

  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(
        new Error("Only JPG, PNG and WEBP images are allowed.")
      );
    }

    cb(null, true);
  }
});

const handleReceiptUpload = (req, res, next) => {
  upload.single("receipt")(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          success: false,
          message: "Receipt image must not exceed 5 MB."
        });
      }

      return res.status(400).json({
        success: false,
        message: "Receipt upload failed: " + error.message
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message || "Invalid receipt upload."
    });
  });
};

// Analyze an uploaded receipt without saving a transaction.
router.post(
  "/analyze",
  protect,
  handleReceiptUpload,
  analyzeReceipt
);

// Save the reviewed receipt fields as an expense transaction.
router.post(
  "/save",
  protect,
  saveReceipt
);

module.exports = router;