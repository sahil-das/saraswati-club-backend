require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// 1. CONFIGURATION
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/club_commitee_saas";

// 2. HARDCODED IDS
const CLUB_ID = "6960c2a329b02c09594be751";
const ADMIN_ID = "6960c2a329b02c09594be74f"; // Sahil

// Members Map (Mohit Removed)
const MEMBERS = [
  // Existing
  { name: "Sahil", id: "6960c2a329b02c09594be74f" },
  { name: "Ayush", id: "6960c30529b02c09594be79b" },
  { name: "Ashish", id: "6960c35829b02c09594be7a9" },
  { name: "Golu", id: "6960c3ad29b02c09594be7b7" },
  { name: "Gourav", id: "6960c3ce29b02c09594be7c5" },
  // Mohit removed
  { name: "Meghnath", id: "6960c43e29b02c09594be7ef" },
  { name: "Nayan", id: "6960c45f29b02c09594be7fd" },
  { name: "Piyush", id: "6960c48829b02c09594be80b" },
  { name: "Shubhojeet", id: "6960c4b429b02c09594be819" },
  // Newer
  { name: "Ankit", id: "6960dd3d09f8e5d112495226" },
  { name: "Karan", id: "6960dd3d09f8e5d112495299" }
];

// 3. MODELS
const FestivalYear = require("../models/FestivalYear");
const Expense = require("../models/Expense");
const MemberFee = require("../models/MemberFee");
const Donation = require("../models/Donation");
const Subscription = require("../models/Subscription");
const Membership = require("../models/Membership");
const User = require("../models/User");

const seed = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("🔌 Connected to DB...");

    // --- 0. ENSURE USERS EXIST ---
    console.log("👥 Verifying Members (11 Total)...");
    
    for (let i = 0; i < MEMBERS.length; i++) {
        const m = MEMBERS[i];
        let user = await User.findById(m.id);
        
        // Check by Email if ID not found (Double safety)
        if (!user) {
            const email = `${m.name.toLowerCase()}@goldenclub.com`;
            user = await User.findOne({ email: email });

            if (user) {
                // Update local ID if found by email
                MEMBERS[i].id = user._id; 
            } else {
                console.log(`   ✨ Creating new user: ${m.name}`);
                const hashedPassword = await bcrypt.hash("123456", 10);
                user = await User.create({
                    _id: m.id,
                    name: m.name,
                    email: email,
                    password: hashedPassword,
                    phone: "0000000000"
                });
            }
        }
        
        let membership = await Membership.findOne({ user: MEMBERS[i].id, club: CLUB_ID });
        if (!membership) {
            console.log(`   🎟️ Creating membership for: ${m.name}`);
            await Membership.create({
                user: MEMBERS[i].id,
                club: CLUB_ID,
                role: "member",
                status: "active"
            });
        }
    }

    // --- DATA PREPARATION ---
    // Using 2024-2025 dates to avoid overlap with 2023-2024
    const startDate = new Date(2024, 2, 3); // 03/03/2024
    const endDate = new Date(2025, 1, 7);   // 07/02/2025

    // 1. OPENING BALANCE (Fixed)
    const openingBalance = 2958;

    // 2. CREATE FESTIVAL YEAR
    console.log("📅 Creating Year: Saraswati Puja 2025...");
    let yearDoc = await FestivalYear.findOne({ club: CLUB_ID, name: "Saraswati Puja 2025" });
    
    if (!yearDoc) {
        yearDoc = new FestivalYear({
            club: CLUB_ID,
            name: "Saraswati Puja 2025",
            createdBy: ADMIN_ID
        });
    }

    yearDoc.startDate = startDate;
    yearDoc.endDate = endDate;
    yearDoc.openingBalance = openingBalance;
    yearDoc.subscriptionFrequency = "weekly";
    yearDoc.totalInstallments = 50;
    yearDoc.amountPerInstallment = 10;
    yearDoc.isActive = false; 
    yearDoc.isClosed = true;

    await yearDoc.save();
    const yearId = yearDoc._id;

    // 3. EXPENSES
    console.log("💸 Seeding Expenses...");
    const expensesData = [
      { title: "Murti", amount: 2500, category: "Idol" },
      { title: "S.T.H", amount: 1500, category: "Decoration" },
      { title: "Visharjan", amount: 2000, category: "Transport" },
      { title: "Bundiya (3kg basan, chivda etc)", amount: 1771, category: "Food" },
      { title: "Decoration", amount: 630, category: "Decoration" },
      { title: "Party", amount: 1770, category: "Food" },
      { title: "Puchka party", amount: 410, category: "Food" },
      { title: "Puja, prasadi", amount: 380, category: "Puja" },
      { title: "Others", amount: 419, category: "Misc" }
    ];

    await Expense.deleteMany({ club: CLUB_ID, year: yearId });
    await Expense.insertMany(expensesData.map(e => ({
        club: CLUB_ID,
        year: yearId,
        title: e.title,
        amount: e.amount,
        category: e.category,
        date: endDate,
        status: "approved",
        recordedBy: ADMIN_ID
    })));

    // 4. DONATIONS
    console.log("🎁 Seeding Donations...");
    await Donation.deleteMany({ club: CLUB_ID, year: yearId });
    await Donation.insertMany([
        {
            club: CLUB_ID, year: yearId, donorName: "Villagers", amount: 3077,
            collectedBy: ADMIN_ID, date: endDate
        },
        {
            club: CLUB_ID, year: yearId, donorName: "Last year extra (chuman)", amount: 137,
            collectedBy: ADMIN_ID, date: endDate
        }
    ]);

    // 5. MEMBER FEES (300 per member)
    console.log("🎫 Seeding Member Fees...");
    await MemberFee.deleteMany({ club: CLUB_ID, year: yearId });

    const feeDocs = MEMBERS.map(m => ({
        club: CLUB_ID,
        year: yearId,
        user: m.id,
        amount: 300,
        notes: "Saraswati Puja Fee 2025",
        collectedBy: ADMIN_ID,
        paidAt: endDate
    }));
    await MemberFee.insertMany(feeDocs);

    // 6. SUBSCRIPTIONS (50 Weeks, All Paid)
    console.log("🔄 Seeding Subscriptions...");
    
    // 50 Paid Installments
    const fullPaidInstallments = [];
    for(let i=1; i<=50; i++) {
        fullPaidInstallments.push({
            number: i,
            amountExpected: 10,
            isPaid: true,
            paidDate: endDate,
            collectedBy: ADMIN_ID
        });
    }
    const totalSubsAmount = 50 * 10; // 500

    let totalSubsCollection = 0;

    for (const member of MEMBERS) {
        const membership = await Membership.findOne({ user: member.id, club: CLUB_ID });
        
        if (!membership) {
            console.log(`   ❌ Membership missing for ${member.name}, skipping sub.`);
            continue;
        }

        totalSubsCollection += totalSubsAmount;

        await Subscription.findOneAndUpdate(
            { club: CLUB_ID, year: yearId, member: membership._id },
            {
                installments: fullPaidInstallments,
                totalPaid: totalSubsAmount,
                totalDue: 0
            },
            { upsert: true, new: true }
        );
    }

    // 7. CALCULATE FINAL BALANCE
    // Income
    const totalDonations = 3077 + 137; // 3214
    const totalFees = 11 * 300; // 3300
    // totalSubsCollection calculated above (11 * 500 = 5500)
    
    const totalIncome = totalDonations + totalFees + totalSubsCollection; // 12014

    // Expense
    const totalExpenses = 2500 + 1500 + 2000 + 1771 + 630 + 1770 + 410 + 380 + 419; // 11380

    const closingBalance = openingBalance + totalIncome - totalExpenses; // 3592

    console.log("🧮 Financial Summary (2025):");
    console.log(`   Opening: ${openingBalance}`);
    console.log(`   Income:  ${totalIncome} (Fees: ${totalFees}, Subs: ${totalSubsCollection}, Donations: ${totalDonations})`);
    console.log(`   Expense: ${totalExpenses}`);
    console.log(`   Closing: ${closingBalance}`);

    yearDoc.closingBalance = closingBalance;
    await yearDoc.save();

    console.log("✅ SEEDING 2025 COMPLETE!");
    process.exit(0);

  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
};

seed();