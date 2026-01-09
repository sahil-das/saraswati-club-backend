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
    // ✅ UPDATE: Added 'isDeleted' to index for fast filtering
    await Expense.collection.createIndex(
      { club: 1, year: 1, isDeleted: 1, date: -1 },
      { background: true }
    );
    // For Status filtering (Approved vs Pending)
    await Expense.collection.createIndex(
      { club: 1, year: 1, status: 1, isDeleted: 1 },
      { background: true }
    );
    console.log("✅ Expense indexes set.");

    // 3. DONATIONS
    // ✅ UPDATE: Added 'isDeleted' to index
    await Donation.collection.createIndex(
      { club: 1, year: 1, isDeleted: 1, date: -1 },
      { background: true }
    );
    // Search text for donor name
    await Donation.collection.createIndex(
        { donorName: "text" },
        { background: true }
    );
    console.log("✅ Donation indexes set.");

    // 4. MEMBER FEES (Chanda)
    // ✅ UPDATE: Added 'isDeleted' to index
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
    // Look up user membership in a club quickly
    await Membership.collection.createIndex(
        { club: 1, user: 1 },
        { unique: true, background: true }
    );
    console.log("✅ Membership indexes set.");

    // 6. AUDIT LOGS
    // TTL Index (Expire logs after 2 years = 63072000 seconds)
    // This prevents the table from growing forever
    await AuditLog.collection.createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: 63072000, background: true }
    );
    // Fast sort for admin dashboard
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