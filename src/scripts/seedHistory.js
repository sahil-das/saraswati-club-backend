require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Import Models
const Club = require("../models/Club");
const User = require("../models/User");
const Membership = require("../models/Membership");
const FestivalYear = require("../models/FestivalYear");
const Subscription = require("../models/Subscription");
const Expense = require("../models/Expense");
const Donation = require("../models/Donation");
const MemberFee = require("../models/MemberFee");

// ✅ CORRECT DATABASE NAME HERE
const MONGO_URI = "mongodb://localhost:27017/club_commitee_saas";
const PASSWORD_HASH = bcrypt.hashSync("123456", 10);

const CLUBS_CONFIG = [
  {
    code: "happy-club", // Matches your DB output
    years: [
      { name: "Saraswati Puja 2023", freq: "weekly", year: 2023, closed: true },
      { name: "Durga Puja 2024", freq: "monthly", year: 2024, closed: true },
      { name: "Saraswati Puja 2025", freq: "weekly", year: 2025, closed: false }
    ]
  },
  {
    code: "golden-club", // Matches your DB output
    years: [
      { name: "Kali Puja 2023", freq: "monthly", year: 2023, closed: true },
      { name: "Laxmi Puja 2024", freq: "none", year: 2024, closed: true }, 
      { name: "Saraswati Puja 2025", freq: "weekly", year: 2025, closed: false }
    ]
  }
];

// --- HELPERS ---
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomDate = (year) => new Date(year, randomInt(0, 11), randomInt(1, 28));

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGO_URI);
    console.log(`✅ Connected to MongoDB at: ${conn.connection.host}`);
    console.log(`   Database Name: ${conn.connection.name}`); // Should now say 'club_commitee_saas'
  } catch (err) {
    console.error("❌ DB Connection Error:", err);
    process.exit(1);
  }
};

const seedClubHistory = async (config) => {
  console.log(`\n🚀 Processing Club Code: "${config.code}"...`);

  // Find by Code
  const club = await Club.findOne({ code: config.code });
  
  if (!club) {
    console.error(`❌ Club with code "${config.code}" not found!`);
    return;
  }
  console.log(`   ✅ Found Club: "${club.name}"`);

  // Ensure Owner & Members Exist
  const members = [];
  const memberships = [];
  
  for (let i = 1; i <= 5; i++) {
    const email = `history_member${i}_${config.code}@test.com`;
    let user = await User.findOne({ email });
    
    if (!user) {
      user = await User.create({
        name: `History User ${i} (${club.name.split(" ")[0]})`,
        email,
        password: PASSWORD_HASH,
        phone: `900000000${i}`
      });
    }
    members.push(user);

    // Ensure Membership
    let membership = await Membership.findOne({ user: user._id, club: club._id });
    if (!membership) {
      membership = await Membership.create({
        user: user._id,
        club: club._id,
        role: "member",
        status: "active"
      });
    }
    memberships.push(membership);
  }

  // Loop Through Years
  for (const yearConfig of config.years) {
    console.log(`   📅 Seeding Year: ${yearConfig.name} (${yearConfig.freq})`);

    let totalInstallments = 0;
    let amountPerInst = 0;

    if (yearConfig.freq === "weekly") {
      totalInstallments = 52; 
      amountPerInst = 50; 
    } else if (yearConfig.freq === "monthly") {
      totalInstallments = 12;
      amountPerInst = 200;
    }

    const startDate = new Date(yearConfig.year, 0, 1);
    const endDate = new Date(yearConfig.year, 11, 31);

    const festivalYear = await FestivalYear.findOneAndUpdate(
      { club: club._id, name: yearConfig.name },
      {
        club: club._id,
        name: yearConfig.name,
        startDate,
        endDate,
        subscriptionFrequency: yearConfig.freq,
        totalInstallments,
        amountPerInstallment: amountPerInst,
        isActive: !yearConfig.closed,
        isClosed: yearConfig.closed,
        openingBalance: yearConfig.closed ? 0 : 5000,
        closingBalance: yearConfig.closed ? randomInt(5000, 25000) : 0,
        createdBy: club.owner
      },
      { upsert: true, new: true }
    );

    // A. Subscriptions
    if (yearConfig.freq !== "none") {
      for (const membership of memberships) {
        const installments = [];
        let paidCount = 0;
        const countToGen = yearConfig.freq === "monthly" ? 12 : 15; 

        for (let k = 1; k <= countToGen; k++) {
          const isPaid = Math.random() > 0.4; 
          if (isPaid) paidCount++;
          
          installments.push({
            number: k,
            amountExpected: amountPerInst,
            isPaid,
            paidDate: isPaid ? randomDate(yearConfig.year) : null,
            collectedBy: isPaid ? club.owner : null
          });
        }

        await Subscription.findOneAndUpdate(
          { club: club._id, year: festivalYear._id, member: membership._id },
          {
            installments,
            totalPaid: paidCount * amountPerInst,
            totalDue: (totalInstallments - paidCount) * amountPerInst
          },
          { upsert: true }
        );
      }
    }

    // B. Expenses
    const categories = ["Pandal", "Idol", "Food", "Lighting", "Priest", "Sound"];
    const expenseCount = randomInt(3, 6);
    for (let j = 0; j < expenseCount; j++) {
      await Expense.create({
        club: club._id,
        year: festivalYear._id,
        title: `${categories[j]} for ${yearConfig.name}`,
        amount: randomInt(1500, 12000),
        category: categories[j],
        status: Math.random() > 0.1 ? "approved" : "rejected",
        date: randomDate(yearConfig.year),
        recordedBy: club.owner
      });
    }

    // C. Donations
    const donorCount = randomInt(2, 5);
    for (let j = 0; j < donorCount; j++) {
      await Donation.create({
        club: club._id,
        year: festivalYear._id,
        donorName: `Local Donor ${j + 1}`,
        amount: randomInt(501, 5001),
        collectedBy: club.owner,
        date: randomDate(yearConfig.year),
        paymentMethod: Math.random() > 0.5 ? "Cash" : "UPI"
      });
    }

    // D. Member Fees
    for (const member of members) {
      if (Math.random() > 0.6) {
        await MemberFee.create({
          club: club._id,
          year: festivalYear._id,
          user: member._id,
          amount: randomInt(200, 1000),
          paidAt: randomDate(yearConfig.year),
          collectedBy: club.owner,
          notes: "Extra Chanda"
        });
      }
    }
  }
};

const run = async () => {
  await connectDB();
  console.log("⏳ Starting History Seeding...");
  for (const config of CLUBS_CONFIG) {
    await seedClubHistory(config);
  }
  console.log("\n✅ History Seeding Complete!");
  process.exit(0);
};

run();