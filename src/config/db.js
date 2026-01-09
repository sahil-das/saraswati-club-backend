const mongoose = require("mongoose");
const logger = require("../utils/logger");
const connectDB = async () => {
  try {
    // FIX: Removed hardcoded dbName. 
    // Mongoose will now use the DB specified in process.env.MONGO_URI
    await mongoose.connect(process.env.MONGO_URI);
    
    logger.info(`✅ MongoDB Connected: ${mongoose.connection.name}`);
  } catch (error) {
    logger.error("❌ MongoDB connection error:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;