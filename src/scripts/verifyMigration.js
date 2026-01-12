// src/scripts/verifyMigration.js
require("dotenv").config();
const mongoose = require("mongoose");
const MemberFee = require("../models/MemberFee");

const check = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    
    // Check for any fee that DOES NOT have a 'member' field
    const remaining = await MemberFee.countDocuments({ member: { $exists: false } });
    
    console.log(`⚠️ Records missing 'member' link: ${remaining}`);
    
    if (remaining === 0) {
        console.log("✅ SAFE TO PROCEED: All records have been migrated.");
    } else {
        console.log("❌ STOP: Do not delete 'user' field. Run the migration script again.");
    }
    process.exit();
};
check();