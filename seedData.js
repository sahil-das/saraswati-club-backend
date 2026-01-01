/* ==========================================================================
   FIXED SEED SCRIPT
   Run: node seedFixed.js
   ========================================================================== */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

// Models
const User = require("./src/models/User");
const PujaCycle = require("./src/models/PujaCycle");
const WeeklyPayment = require("./src/models/WeeklyPayment");
const PujaContribution = require("./src/models/PujaContribution");
const Donation = require("./src/models/Donation");
const Expense = require("./src/models/Expense");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/saraswati-club";

const seed = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // 1. CLEAR OLD DATA
    await Promise.all([
      User.deleteMany({}),
      PujaCycle.deleteMany({}),
      WeeklyPayment.deleteMany({}),
      PujaContribution.deleteMany({}),
      Donation.deleteMany({}),
      Expense.deleteMany({}),
    ]);
    console.log("🧹 Data Cleared");

    // 2. CREATE USERS
    const password = await bcrypt.hash("123456", 10);
    const admin = await User.create({ name: "Sahil Admin", email: "admin@club.com", password, role: "admin", phone: "9876543210" });
    
    // Create 5 Fixed Members
    const members = await User.insertMany([
      { name: "Rahul Sharma", email: "rahul@club.com", password, role: "member", phone: "901" },
      { name: "Amit Verma", email: "amit@club.com", password, role: "member", phone: "902" },
      { name: "Priya Singh", email: "priya@club.com", password, role: "member", phone: "903" },
      { name: "Sneha Das", email: "sneha@club.com", password, role: "member", phone: "904" },
      { name: "Vikram Malhotra", email: "vikram@club.com", password, role: "member", phone: "905" },
    ]);

    // ====================================================
    // 🗓️ 2024 CYCLE (CLOSED)
    // ====================================================
    const cycle2024 = await PujaCycle.create({
      name: "Saraswati Puja 2024",
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-12-31"),
      weeklyAmount: 50,
      totalWeeks: 52,
      openingBalance: 0,
      closingBalance: 1153, // Manually set to match calculation
      isActive: false,
      isClosed: true,
      closedAt: new Date("2024-12-31"),
    });

    // 2024 Weekly: 4 Members Full (52 wks), 1 Member Missed 2 (50 wks)
    for (let i = 0; i < 5; i++) {
      const member = members[i];
      // Vikram (Index 4) pays 50 weeks, others pay 52
      const weeksPaidCount = (i === 4) ? 50 : 52; 

      const weeks = Array.from({ length: 52 }, (_, w) => ({
        week: w + 1,
        paid: w < weeksPaidCount, // True for first N weeks
        paidAt: new Date("2024-06-01"),
      }));

      await WeeklyPayment.create({ member: member._id, cycle: cycle2024._id, weeks });
    }

    // 2024 Puja
    await PujaContribution.create([
      { member: members[0]._id, cycle: cycle2024._id, amount: 501, addedBy: admin._id },
      { member: members[1]._id, cycle: cycle2024._id, amount: 1001, addedBy: admin._id },
      { member: members[2]._id, cycle: cycle2024._id, amount: 251, addedBy: admin._id },
    ]);

    // 2024 Donations
    await Donation.create([
      { donorName: "Local MLA", amount: 5000, cycle: cycle2024._id, addedBy: admin._id },
      { donorName: "Gupta Sweets", amount: 2000, cycle: cycle2024._id, addedBy: admin._id },
    ]);

    // 2024 Expenses
    await Expense.create([
      { title: "Idol", amount: 12000, cycle: cycle2024._id, status: "approved", addedBy: admin._id },
      { title: "Prasad", amount: 5000, cycle: cycle2024._id, status: "approved", addedBy: admin._id },
      { title: "Sound", amount: 3500, cycle: cycle2024._id, status: "approved", addedBy: admin._id },
    ]);


    // ====================================================
    // 🗓️ 2025 CYCLE (ACTIVE)
    // ====================================================
    const cycle2025 = await PujaCycle.create({
      name: "Saraswati Puja 2025",
      startDate: new Date("2025-01-01"),
      endDate: new Date("2025-12-31"),
      weeklyAmount: 60,
      totalWeeks: 52,
      openingBalance: 1153, // Must match 2024 Closing
      isActive: true,
      isClosed: false,
    });

    // 2025 Weekly: All 5 Members paid exactly 10 weeks
    for (const member of members) {
      const weeks = Array.from({ length: 52 }, (_, w) => ({
        week: w + 1,
        paid: w < 10, // First 10 weeks paid
        paidAt: w < 10 ? new Date() : null,
      }));

      await WeeklyPayment.create({ member: member._id, cycle: cycle2025._id, weeks });
    }

    // 2025 Puja
    await PujaContribution.create([
      { member: members[3]._id, cycle: cycle2025._id, amount: 501, addedBy: admin._id },
      { member: members[4]._id, cycle: cycle2025._id, amount: 101, addedBy: admin._id },
    ]);

    // 2025 Donations
    await Donation.create([
      { donorName: "Anonymous", amount: 1100, cycle: cycle2025._id, addedBy: admin._id },
    ]);

    // 2025 Expenses
    await Expense.create([
      { title: "Advance Idol", amount: 5000, cycle: cycle2025._id, status: "approved", addedBy: admin._id },
      { title: "Tent Booking", amount: 2000, cycle: cycle2025._id, status: "pending", addedBy: admin._id }, // Pending (Ignored in total)
      { title: "Bad Print", amount: 800, cycle: cycle2025._id, status: "rejected", addedBy: admin._id },   // Rejected (Ignored in total)
    ]);

    console.log("\n✅ FIXED Data Seeded. Check Dashboard for Totals!");
    process.exit();

  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seed();