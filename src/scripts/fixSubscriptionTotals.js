require("dotenv").config();
const mongoose = require("mongoose");
const Subscription = require("../models/Subscription");

const resetSubs = async () => {
  try {
    console.log("🔌 Connecting to DB...");
    await mongoose.connect(process.env.MONGO_URI);
    
    console.log("🗑️ Deleting ALL Subscriptions...");
    const result = await Subscription.deleteMany({});
    
    console.log(`✅ Deleted ${result.deletedCount} corrupted subscriptions.`);
    console.log("✨ System is clean. New payments will generate correct data.");
    
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
};

resetSubs();