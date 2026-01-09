const mongoose = require('mongoose');

// 🔻 CHECK YOUR MODEL PATHS (Adjust if your files are named differently, e.g., userModel.js)
const Year = require('../models/FestivalYear');       
const Expense = require('../models/Expense'); 
const Donation = require('../models/Donation'); 
const User = require('../models/User'); 

// ==========================================
// 1. CONFIGURATION (Based on your Data)
// ==========================================
const MONGO_URI = "mongodb://127.0.0.1:27017/ClubKhata?replicaSet=rs0"; // 🔴 PASTE URI HERE

const CLUB_ID = "6960c2a329b02c09594be751"; // Golden Club
const SAHIL_ADMIN_ID = "6960c2a329b02c09594be74f"; // Sahil Das (Admin)

// Event Details
const EVENT_NAME = "Saraswati Puja 2023";
const EVENT_DATE = "2023-01-25"; 
const OPENING_BALANCE = 3270; 

// ==========================================
// 2. MEMBER DATA (Mapped to your IDs)
// ==========================================
const MEMBERS = [
    { name: "Sahil Das", id: "6960c2a329b02c09594be74f" },
    { name: "Ayush Das", id: "6960c30529b02c09594be79b" },
    { name: "Ashish Das", id: "6960c35829b02c09594be7a9" },
    { name: "Golu Das", id: "6960c3ad29b02c09594be7b7" },
    { name: "Gourav Das", id: "6960c3ce29b02c09594be7c5" },
    { name: "Mohit Das", id: "6960c41a29b02c09594be7e1" },
    { name: "Meghnath das", id: "6960c43e29b02c09594be7ef" },
    { name: "Nayan Das", id: "6960c45f29b02c09594be7fd" },
    { name: "Piyush Das", id: "6960c48829b02c09594be80b" },
    { name: "Shubhojeet Das", id: "6960c4b429b02c09594be819" }
];

const MEMBER_FEE = 500; // 50 weeks * 10rs

// ==========================================
// 3. EXPENSE DATA
// ==========================================
const EXPENSES = [
  { description: "Murti", amount: 2700 },
  { description: "S.T.H (Sound/Tent)", amount: 1500 },
  { description: "Visharjan", amount: 1500 },
  { description: "Prashad", amount: 850 },
  { description: "Party", amount: 1140 },
  { description: "Others", amount: 1435 }
];

// ==========================================
// 4. MAIN SCRIPT
// ==========================================
const importData = async () => {
    try {
        console.log("🔌 Connecting to DB...");
        await mongoose.connect(MONGO_URI);
        console.log("✅ DB Connected.");

        // --- A. CLEANUP (Delete 'Saraswati Puja 2023' if exists to avoid duplicates) ---
        const existingYear = await Year.findOne({ name: EVENT_NAME, club: CLUB_ID });
        if (existingYear) {
            console.log("🧹 Found existing 2023 records. Deleting them...");
            await Expense.deleteMany({ year: existingYear._id });
            await Donation.deleteMany({ year: existingYear._id });
            await Year.findByIdAndDelete(existingYear._id);
        }

        // --- B. CREATE YEAR ---
        console.log(`📅 Creating Year: ${EVENT_NAME}`);
        const newYear = await Year.create({
            name: EVENT_NAME,
            year: "2023",
            club: CLUB_ID,
            date: EVENT_DATE,
            openingBalance: OPENING_BALANCE,
            active: false
        });

        // --- C. PROCESS EXPENSES ---
        const expenseDocs = EXPENSES.map(exp => ({
            description: exp.description,
            amount: exp.amount,
            date: EVENT_DATE,
            club: CLUB_ID,
            year: newYear._id
        }));
        await Expense.insertMany(expenseDocs);
        console.log(`💸 Inserted ${expenseDocs.length} Expenses`);

        // --- D. PROCESS DONATIONS ---
        const donationDocs = [];

        // 1. Villagers (General Donation)
        donationDocs.push({
            donorName: "Villagers", // No userId for external
            amount: 1160,
            date: EVENT_DATE,
            club: CLUB_ID,
            year: newYear._id,
            collectedBy: SAHIL_ADMIN_ID // REQUIRED field
        });

        // 2. Members (Linked to User IDs)
        MEMBERS.forEach(member => {
            donationDocs.push({
                userId: member.id, // Linking to the User ID provided
                // Note: Some schemas use 'memberId', check your Donation schema if 'userId' fails
                donorName: member.name, // Optional fallback
                amount: MEMBER_FEE,
                date: EVENT_DATE,
                club: CLUB_ID,
                year: newYear._id,
                collectedBy: SAHIL_ADMIN_ID // REQUIRED field
            });
        });

        await Donation.insertMany(donationDocs);
        console.log(`💰 Inserted ${donationDocs.length} Donations (Villagers + 10 Members)`);

        // --- E. UPDATE YEAR TOTALS ---
        const totalExpenses = expenseDocs.reduce((sum, i) => sum + i.amount, 0);
        const totalCollections = donationDocs.reduce((sum, i) => sum + i.amount, 0);
        const closingBalance = (OPENING_BALANCE + totalCollections) - totalExpenses;

        newYear.totalExpenses = totalExpenses;
        newYear.totalCollection = totalCollections;
        newYear.balance = closingBalance;
        await newYear.save();

        console.log("\n=================================");
        console.log(`✅ IMPORT SUCCESSFUL: ${EVENT_NAME}`);
        console.log(`   Opening Balance:  ₹${OPENING_BALANCE}`);
        console.log(`   + Collections:    ₹${totalCollections}`);
        console.log(`   - Expenses:       ₹${totalExpenses}`);
        console.log(`   -----------------------------`);
        console.log(`   = Final Balance:  ₹${closingBalance}`);
        console.log("=================================\n");

        process.exit();

    } catch (error) {
        console.error("\n❌ ERROR:", error);
        process.exit(1);
    }
};

importData();