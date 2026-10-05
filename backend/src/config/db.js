const mongoose = require('mongoose');

const connectDB = async (customUri) => {
  try {
    const mongoUri = customUri || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart_expense_tracker';
    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    if (!process.env.USE_MEMORY_DB) {
      process.exit(1);
    }
  }
};

module.exports = connectDB;
