const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // 🚀 Explicitly switch to a new database for the SaaS architecture
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "club_commitee_saas" 
    });
    
    console.log("✅ MongoDB Connected to database: club_commitee_saas");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;