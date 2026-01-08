const mongoose = require("mongoose");
const { env } = require("../config/env");

// Import Models
const Subscription = require("../models/Subscription");
const Expense = require("../models/Expense");
const Donation = require("../models/Donation");
const MemberFee = require("../models/MemberFee");
const AuditLog = require("../models/AuditLog");
const Membership = require("../models/Membership");

const createIndexes = async () => {
  try {
    console.log("🔌 Connecting to DB...");
    await mongoose.connect(env.MONGO_URI);
    console.log("✅ Connected.");

    console.log("🏗️  Building Indexes...");

    // 1. SUBSCRIPTIONS
    // Most queries are: Find sub for a specific club, year, and member
    await Subscription.collection.createIndex(
      { club: 1, year: 1, member: 1 },
      { unique: true, background: true }
    );
    // Find all paid installments for analytics
    await Subscription.collection.createIndex(
        { club: 1, year: 1, "installments.isPaid": 1 },
        { background: true }
    );
    console.log("✅ Subscription indexes set.");

    // 2. EXPENSES
    // Sorting expenses by date for a specific year is the most common view
    await Expense.collection.createIndex(
      { club: 1, year: 1, date: -1 },
      { background: true }
    );
    console.log("✅ Expense indexes set.");

    // 3. DONATIONS
    // Search donors or sort by date
    await Donation.collection.createIndex(
      { club: 1, year: 1, date: -1 },
      { background: true }
    );
    // Search text for donor name (Optional, but good for search bar)
    await Donation.collection.createIndex(
        { donorName: "text" },
        { background: true }
    );
    console.log("✅ Donation indexes set.");

    // 4. MEMBER FEES (Chanda)
    await MemberFee.collection.createIndex(
      { club: 1, year: 1, user: 1 },
      { background: true }
    );
    console.log("✅ MemberFee indexes set.");

    // 5. MEMBERSHIP
    // Look up user membership in a club quickly
    await Membership.collection.createIndex(
        { club: 1, user: 1 },
        { unique: true, background: true }
    );
    console.log("✅ Membership indexes set.");

    // 6. AUDIT LOGS
    // TTL Index is already in schema, but let's ensure sorting is fast
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