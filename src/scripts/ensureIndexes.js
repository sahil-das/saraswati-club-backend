require("dotenv").config(); // Load environment variables
const mongoose = require("mongoose");

// Use process.env directly for safety
const MONGO_URI = process.env.MONGO_URI; 

// Import Models
const Subscription = require("../models/Subscription");
const Expense = require("../models/Expense");
const Donation = require("../models/Donation");
const MemberFee = require("../models/MemberFee");
const AuditLog = require("../models/AuditLog");
const Membership = require("../models/Membership");

const createIndexes = async () => {
  try {
    if (!MONGO_URI) {
        throw new Error("MONGO_URI is missing in .env file");
    }

    console.log("🔌 Connecting to DB...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected.");

    console.log("🏗️  Building Indexes...");

    // 1. SUBSCRIPTIONS
    await Subscription.collection.createIndex(
      { club: 1, year: 1, member: 1 },
      { unique: true, background: true }
    );
    await Subscription.collection.createIndex(
        { club: 1, year: 1, "installments.isPaid": 1 },
        { background: true }
    );
    console.log("✅ Subscription indexes set.");

    // 2. EXPENSES
    await Expense.collection.createIndex(
      { club: 1, year: 1, isDeleted: 1, date: -1 },
      { background: true }
    );
    await Expense.collection.createIndex(
      { club: 1, year: 1, status: 1, isDeleted: 1 },
      { background: true }
    );
    console.log("✅ Expense indexes set.");

    // 3. DONATIONS
    await Donation.collection.createIndex(
      { club: 1, year: 1, isDeleted: 1, date: -1 },
      { background: true }
    );
    await Donation.collection.createIndex(
        { donorName: "text" },
        { background: true }
    );
    console.log("✅ Donation indexes set.");

    // 4. MEMBER FEES (Chanda)
    await MemberFee.collection.createIndex(
      { club: 1, year: 1, user: 1, isDeleted: 1 },
      { background: true }
    );
    await MemberFee.collection.createIndex(
      { club: 1, year: 1, isDeleted: 1 },
      { background: true }
    );
    console.log("✅ MemberFee indexes set.");

    // 5. MEMBERSHIP
    await Membership.collection.createIndex(
        { club: 1, user: 1 },
        { unique: true, background: true }
    );
    console.log("✅ Membership indexes set.");

    // 6. AUDIT LOGS (With Conflict Fix)
    // 🗑️ Drop old index if it exists to allow updating the expire time
    try {
        await AuditLog.collection.dropIndex("createdAt_1");
        console.log("   ↳ Old AuditLog index dropped to update expiry time.");
    } catch (e) {
        // Ignore error if index didn't exist
    }

    // Create new TTL Index (Expire logs after 2 years)
    await AuditLog.collection.createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: 63072000, background: true }
    );
    // Sort index
    await AuditLog.collection.createIndex(
        { club: 1, createdAt: -1 },
        { background: true }
    );
    console.log("✅ AuditLog indexes set.");

    console.log("🎉 All indexes ensured successfully.");
    process.exit(0);

  } catch (err) {
    console.error("❌ Indexing failed:", err);
    process.exit(1);
  }
};

createIndexes();