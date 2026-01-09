require("dotenv").config();
const mongoose = require("mongoose");

// 👇 CRITICAL FIX: Import User model so Mongoose knows about it
const User = require("../models/User"); 
const Club = require("../models/Club");
const Membership = require("../models/Membership");

const getIds = async () => {
  try {
    console.log("🔌 Connecting to DB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected.\n");

    // 1. Fetch Clubs
    const clubs = await Club.find({});
    
    if (clubs.length === 0) {
        console.log("❌ No clubs found in database.");
        process.exit();
    }

    console.log("====== 🏠 CLUBS ======");
    for (const club of clubs) {
        // Try both common field names (name or clubName)
        const name = club.name || club.clubName || "Unknown Club";
        
        console.log(`Club Name: ${name}`);
        console.log(`Club ID:   ${club._id}`); // 👈 COPY THIS
        console.log("-----------------------");

        // 2. Fetch Members for this Club
        console.log(`👥 Members in ${name}:`);
        
        const memberships = await Membership.find({ club: club._id })
            .populate("user", "name email personalEmail phone");

        if (memberships.length === 0) {
            console.log("   (No members found)");
        } else {
            // Print in a format easy to copy
            memberships.forEach(m => {
                const u = m.user;
                if (u) {
                    const email = u.email || u.personalEmail || "No Email";
                    // Pad name for alignment
                    console.log(`   ID: ${u._id}  |  Name: ${u.name.padEnd(20)} | Email: ${email}`);
                }
            });
        }
        console.log("\n=======================\n");
    }

    process.exit(0);

  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
};

getIds();