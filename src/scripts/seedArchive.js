const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Load Environment Variables
dotenv.config();

// ---------------------------------------------------------
// 1. CONFIGURATION
// ---------------------------------------------------------
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/clubkhata"; 

// ---------------------------------------------------------
// 2. HARDCODED IDS
// ---------------------------------------------------------
const CLUB_ID_STR = "6958b2104e47a191c0cb0e56";
const ADMIN_ID_STR = "6958b2104e47a191c0cb0e54";

// ---------------------------------------------------------
// 3. IMPORT MODELS
// ---------------------------------------------------------
const User = require("../models/User"); 
const FestivalYear = require("../models/FestivalYear");
const Expense = require("../models/Expense");
const MemberFee = require("../models/MemberFee");
const Donation = require("../models/Donation");
const Subscription = require("../models/Subscription");

const seedData = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB Connected...");

    const clubId = new mongoose.Types.ObjectId(CLUB_ID_STR);
    const adminId = new mongoose.Types.ObjectId(ADMIN_ID_STR);

    // Generate specific IDs 
    const yearId = new mongoose.Types.ObjectId();
    const user1_Id = new mongoose.Types.ObjectId();
    const user2_Id = new mongoose.Types.ObjectId();
    const user3_Id = new mongoose.Types.ObjectId();

    console.log(`👉 Seeding for Club: ${CLUB_ID_STR}`);

    // ---------------------------------------------------------
    // 4. CLEANUP: Delete previous mock data to avoid Duplicates
    // ---------------------------------------------------------
    const mockEmails = ["rahul.mock@test.com", "amit.mock@test.com", "priya.mock@test.com"];
    
    // Only delete the specific mock users we are about to create
    await User.deleteMany({ email: { $in: mockEmails } });
    console.log("🧹 Cleaned up old mock users...");

    // ---------------------------------------------------------
    // 5. DEFINE FINANCIALS
    // ---------------------------------------------------------
    const openingBalance = 5200.00; 

    // A. EXPENSES
    const expenses = [
      { club: clubId, year: yearId, title: "Main Idol (Murtikar)", amount: 8000, category: "Idol", date: new Date("2024-10-15"), status: "approved", recordedBy: adminId },
      { club: clubId, year: yearId, title: "Sound & Lighting", amount: 5000, category: "Sound", date: new Date("2024-10-16"), status: "approved", recordedBy: adminId },
      { club: clubId, year: yearId, title: "Decoration", amount: 2000, category: "Decoration", date: new Date("2024-10-14"), status: "approved", recordedBy: adminId }
    ]; 

    // B. DONATIONS
    const donations = [
      { club: clubId, year: yearId, donorName: "Local MLA", amount: 2500, date: new Date("2024-10-10"), collectedBy: adminId },
      { club: clubId, year: yearId, donorName: "Gupta Sweets", amount: 2000, date: new Date("2024-10-12"), collectedBy: adminId }
    ]; 

    // C. MEMBER FEES
    const fees = [
      { club: clubId, year: yearId, user: user1_Id, amount: 1000, notes: "Puja Chanda", collectedBy: adminId },
      { club: clubId, year: yearId, user: user2_Id, amount: 1000, notes: "Puja Chanda", collectedBy: adminId }
    ]; 

    // D. SUBSCRIPTIONS (Using 'member' correctly now)
    const subscriptions = [
      {
        club: clubId, 
        year: yearId, 
        member: user1_Id, 
        amountPerInstallment: 500, 
        totalInstallments: 12,
        installments: [
            { month: 1, amountExpected: 500, isPaid: true, paidAt: new Date() },
            { month: 2, amountExpected: 500, isPaid: true, paidAt: new Date() },
            { month: 3, amountExpected: 500, isPaid: true, paidAt: new Date() },
            { month: 4, amountExpected: 500, isPaid: true, paidAt: new Date() },
            { month: 5, amountExpected: 500, isPaid: true, paidAt: new Date() },
            { month: 6, amountExpected: 500, isPaid: true, paidAt: new Date() }
        ]
      },
      {
        club: clubId, 
        year: yearId, 
        member: user2_Id, 
        amountPerInstallment: 500, 
        totalInstallments: 12,
        installments: Array(12).fill({ amountExpected: 500, isPaid: true, paidAt: new Date() }) 
      },
      {
        club: clubId, 
        year: yearId, 
        member: user3_Id, 
        amountPerInstallment: 500, 
        totalInstallments: 12,
        installments: Array(6).fill({ amountExpected: 500, isPaid: true, paidAt: new Date() }) 
      }
    ]; 

    // ---------------------------------------------------------
    // 6. CALCULATE TOTALS
    // ---------------------------------------------------------
    const totalExpenses = 15000;
    const totalIncome = 4500 + 2000 + 12000; 
    const netBalance = openingBalance + totalIncome - totalExpenses; 

    // ---------------------------------------------------------
    // 7. DB INSERTION
    // ---------------------------------------------------------
    
    // Create Users (Mocking members)
    await User.insertMany([
        { 
            _id: user1_Id, 
            name: "Rahul Sharma (Mock)", 
            club: clubId, 
            phone: "9000000001", 
            email: mockEmails[0], // Using defined emails
            password: "hash", 
            role: "member" 
        },
        { 
            _id: user2_Id, 
            name: "Amit Verma (Mock)", 
            club: clubId, 
            phone: "9000000002", 
            email: mockEmails[1],
            password: "hash", 
            role: "member" 
        },
        { 
            _id: user3_Id, 
            name: "Priya Singh (Mock)", 
            club: clubId, 
            phone: "9000000003", 
            email: mockEmails[2],
            password: "hash", 
            role: "member" 
        }
    ]);

    await FestivalYear.create({
        _id: yearId,
        club: clubId,
        name: "Durga Puja 2024 (Mock Data)",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-12-30"),
        subscriptionFrequency: "monthly",
        totalInstallments: 12,
        amountPerInstallment: 500,
        isActive: false,
        isClosed: true, 
        openingBalance: openingBalance,
        closingBalance: netBalance,
        createdBy: adminId
    });

    await Expense.insertMany(expenses);
    await Donation.insertMany(donations);
    await MemberFee.insertMany(fees);
    await Subscription.insertMany(subscriptions);

    console.log("✅ Seed Data Inserted Successfully!");
    
    process.exit();

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

seedData();