require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// 1. CONFIGURATION
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/club_commitee_saas";

// 2. HARDCODED IDS
const CLUB_ID = "6960c2a329b02c09594be751";
const ADMIN_ID = "6960c2a329b02c09594be74f"; // Sahil

// Members Map
const MEMBERS = [
  // Existing
  { name: "Sahil", id: "6960c2a329b02c09594be74f" },
  { name: "Ayush", id: "6960c30529b02c09594be79b" },
  { name: "Ashish", id: "6960c35829b02c09594be7a9" },
  { name: "Golu", id: "6960c3ad29b02c09594be7b7" },
  { name: "Gourav", id: "6960c3ce29b02c09594be7c5" },
  { name: "Mohit", id: "6960c41a29b02c09594be7e1" }, // Special Case
  { name: "Meghnath", id: "6960c43e29b02c09594be7ef" },
  { name: "Nayan", id: "6960c45f29b02c09594be7fd" },
  { name: "Piyush", id: "6960c48829b02c09594be80b" },
  { name: "Shubhojeet", id: "6960c4b429b02c09594be819" },
  // New
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

    // --- 0. ENSURE USERS EXIST (With Duplicate Check) ---
    console.log("👥 Verifying Members...");
    
    // We use a normal for-loop to allow updating 'm.id' if needed
    for (let i = 0; i < MEMBERS.length; i++) {
        const m = MEMBERS[i];
        
        // A. Check by ID first
        let user = await User.findById(m.id);
        
        // B. If not found by ID, check by Email (Fix for Duplicate Key Error)
        if (!user) {
            const email = `${m.name.toLowerCase()}@goldenclub.com`;
            user = await User.findOne({ email: email });

            if (user) {
                console.log(`   ⚠️ Found existing user ${m.name} by email. Updating ID map...`);
                // Update the ID in our local list to match the DB
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
        
        // Ensure Membership
        // We use the (potentially updated) ID from MEMBERS[i]
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
    const startDate = new Date(2023, 2, 3); // 03/03/2023
    const endDate = new Date(2024, 1, 20);  // 20/02/2024

    // 1. OPENING BALANCE (FIXED)
    const openingBalance = 2511;

    // 2. CREATE FESTIVAL YEAR
    console.log("📅 Creating Year: Saraswati Puja 2024...");
    let yearDoc = await FestivalYear.findOne({ club: CLUB_ID, name: "Saraswati Puja 2024" });
    
    if (!yearDoc) {
        yearDoc = new FestivalYear({
            club: CLUB_ID,
            name: "Saraswati Puja 2024",
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
      { title: "Murti", amount: 1200, category: "Idol" },
      { title: "S.T.H", amount: 1500, category: "Decoration" },
      { title: "Visharjan", amount: 1500, category: "Transport" },
      { title: "Bundiya (2kg basan, etc)", amount: 1000, category: "Food" },
      { title: "Puja decoration etc", amount: 1285, category: "Decoration" },
      { title: "Party", amount: 1413, category: "Food" },
      { title: "Others", amount: 391, category: "Misc" }
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
    await Donation.create({
        club: CLUB_ID,
        year: yearId,
        donorName: "Villagers",
        amount: 1326,
        collectedBy: ADMIN_ID,
        date: endDate
    });

    // 5. MEMBER FEES (300 per member, EXCEPT Mohit)
    console.log("🎫 Seeding Member Fees...");
    await MemberFee.deleteMany({ club: CLUB_ID, year: yearId });

    const feeDocs = [];
    for (const m of MEMBERS) {
        if (m.name === "Mohit") {
            console.log("   🚫 Skipping Fee for Mohit");
            continue; 
        }
        feeDocs.push({
            club: CLUB_ID,
            year: yearId,
            user: m.id, // Using correct ID (updated or original)
            amount: 200,
            notes: "Saraswati Puja Fee 2024",
            collectedBy: ADMIN_ID,
            paidAt: endDate
        });
    }
    await MemberFee.insertMany(feeDocs);

    // 6. SUBSCRIPTIONS
    console.log("🔄 Seeding Subscriptions...");
    
    const createInstallments = (count, paidCount) => {
        const arr = [];
        for(let i=1; i<=50; i++) {
            const isPaid = i <= paidCount;
            arr.push({
                number: i,
                amountExpected: 10,
                isPaid: isPaid,
                paidDate: isPaid ? endDate : null,
                collectedBy: isPaid ? ADMIN_ID : null
            });
        }
        return arr;
    };

    let totalSubsCollection = 0;

    for (const member of MEMBERS) {
        const membership = await Membership.findOne({ user: member.id, club: CLUB_ID });
        if (!membership) {
            console.log(`❌ Membership missing for ${member.name}, skipping sub.`);
            continue;
        }

        let paidWeeks = 50; 
        
        // Special Cases
        if (member.name === "Mohit") paidWeeks = 11;
        if (member.name === "Ankit") paidWeeks = 0;

        const installments = createInstallments(50, paidWeeks);
        const paidAmount = paidWeeks * 10;
        const dueAmount = (50 - paidWeeks) * 10;
        
        totalSubsCollection += paidAmount;

        await Subscription.findOneAndUpdate(
            { club: CLUB_ID, year: yearId, member: membership._id },
            {
                installments: installments,
                totalPaid: paidAmount,
                totalDue: dueAmount
            },
            { upsert: true, new: true }
        );
    }

    // 7. CALCULATE FINAL BALANCE
    const totalDonations = 1326;
    // 12 Members: Mohit skipped fee (300). Ankit paid fee (300). 11 Paid.
    const totalFees = 11 * 300; // 3300
    
    const totalIncome = totalDonations + totalFees + totalSubsCollection;
    const totalExpenses = 1200 + 1500 + 1500 + 1000 + 1285 + 1413 + 391; // 8289

    const closingBalance = openingBalance + totalIncome - totalExpenses; // 3958

    console.log("🧮 Financial Summary:");
    console.log(`   Opening: ${openingBalance}`);
    console.log(`   Income:  ${totalIncome} (Fees: ${totalFees}, Subs: ${totalSubsCollection}, Donations: ${totalDonations})`);
    console.log(`   Expense: ${totalExpenses}`);
    console.log(`   Closing: ${closingBalance}`);

    yearDoc.closingBalance = closingBalance;
    await yearDoc.save();

    console.log("✅ SEEDING 2024 COMPLETE!");
    process.exit(0);

  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
};

seed();