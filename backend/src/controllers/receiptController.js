const receiptService = require("../services/receiptService");

const analyzeReceipt = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Receipt image is required"
      });
    }

    const result = await receiptService.analyzeReceipt(req.file);

    res.status(200).json({
      success: true,
      message: "Receipt analyzed successfully",
      receipt: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  analyzeReceipt
};