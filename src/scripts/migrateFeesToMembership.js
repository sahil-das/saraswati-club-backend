require("dotenv").config();
const mongoose = require("mongoose");
const MemberFee = require("../models/MemberFee");
const Membership = require("../models/Membership");

const migrate = async () => {
  try {
    console.log("🚀 Connecting to DB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected. Starting Migration...");

    // 1. Find all fees that DON'T have a 'member' field yet
    const feesToMigrate = await MemberFee.find({ 
        member: { $exists: false },
        user: { $exists: true } 
    });

    console.log(`Found ${feesToMigrate.length} fees to migrate.`);

    let successCount = 0;
    let errorCount = 0;

    for (const fee of feesToMigrate) {
        // 2. Find the Membership matching this User + Club
        const membership = await Membership.findOne({
            user: fee.user,
            club: fee.club
        });

        if (membership) {
            // 3. Update the Fee Record
            fee.member = membership._id;
            await fee.save();
            process.stdout.write("."); // Progress dot
            successCount++;
        } else {
            console.error(`\n❌ Skipping Fee ID ${fee._id}: No Membership found for User ${fee.user} in Club ${fee.club}`);
            errorCount++;
        }
    }

    console.log("\n\n============================");
    console.log("🎉 MIGRATION COMPLETE");
    console.log(`✅ Successfully Updated: ${successCount}`);
    console.log(`❌ Failed / Skipped:     ${errorCount}`);
    console.log("============================");

    process.exit();
  } catch (err) {
    console.error("Fatal Error:", err);
    process.exit(1);
  }
};

migrate();