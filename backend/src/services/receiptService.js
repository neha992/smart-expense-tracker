const analyzeReceipt = async (file) => {
  /*
   * Temporary extraction result.
   *
   * This will be replaced with real OCR
   * in the next phase.
   */

  return {
    merchant: "ABC Store",
    amount: 2450,
    date: "2026-10-05",
    category: "Shopping"
  };
};

module.exports = {
  analyzeReceipt
};