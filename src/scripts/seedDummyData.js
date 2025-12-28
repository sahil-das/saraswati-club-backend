require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// MODELS (MATCHING YOUR PROJECT)
const User = require("../models/User");
const FinancialYear = require("../models/FinancialYear");
const WeeklyContribution = require("../models/WeeklyContribution");
const PujaContribution = require("../models/PujaContribution");
const Donation = require("../models/Donation");
const Expense = require("../models/Expense");

(async () => {
  try {
    // =========================
    // CONNECT DB
    // =========================
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ DB connected");

    // =========================
    // FINANCIAL YEAR (2025)
    // =========================
    let fy = await FinancialYear.findOne({ year: 2025 });

    if (!fy) {
      fy = await FinancialYear.create({
        year: 2025,
        openingBalance: 2000,
        isClosed: false,
      });
      console.log("📅 Financial Year 2025 created");
    } else {
      console.log("📅 Financial Year 2025 already exists");
    }

    // =========================
    // MEMBERS
    // =========================
    const memberEmails = [
      "rahul@clubname.com",
      "amit@clubname.com",
      "sumit@clubname.com",
    ];

    const members = [];

    for (const email of memberEmails) {
      let user = await User.findOne({ email });

      if (!user) {
        user = await User.create({
          email,
          password: await bcrypt.hash("123456", 10),
          role: "member",
        });
      }

      members.push(user);
    }

    console.log("👥 Members ready");

    // =========================
    // WEEKLY CONTRIBUTIONS
    // =========================
    await WeeklyContribution.deleteMany({ year: 2025 });

    for (let week = 1; week <= 10; week++) {
      for (const member of members) {
        await WeeklyContribution.create({
        member: member._id,
        amount: 100,
        weekNumber: week,
        year: 2025,
        paidAt: new Date(),
        });

      }
    }

    console.log("💰 Weekly contributions added");

    // =========================
    // PUJA CONTRIBUTIONS
    // =========================
    await PujaContribution.deleteMany({ year: fy._id });

    for (const member of members) {
    await PujaContribution.create({
        member: member._id,
        amount: 500,
        year: fy._id,        // ✅ ObjectId reference
        paidAt: new Date(),
    });
    }
    console.log("🙏 Puja contributions added");


    // =========================
    // DONATIONS
    // =========================
    await Donation.deleteMany({ year: 2025 });

    await Donation.insertMany([
      {
        name: "Local Shop",
        amount: 1000,
        date: new Date("2025-01-10"),
        year: 2025,
      },
      {
        name: "Ex Club Member",
        amount: 1500,
        date: new Date("2025-01-18"),
        year: 2025,
      },
    ]);

    console.log("🎁 Donations added");

    // =========================
    // EXPENSES
    // =========================
    await Expense.deleteMany({ year: 2025 });

    await Expense.insertMany([
      {
        title: "Puja Samagri",
        amount: 2500,
        year: 2025,
        status: "approved",
      },
      {
        title: "Decoration",
        amount: 1800,
        year: 2025,
        status: "approved",
      },
      {
        title: "Sound System",
        amount: 1200,
        year: 2025,
        status: "approved",
      },
    ]);

    console.log("🧾 Expenses added");

    console.log("🎉 ALL DUMMY DATA SEEDED SUCCESSFULLY");
    process.exit();
  } catch (err) {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  }
})();
