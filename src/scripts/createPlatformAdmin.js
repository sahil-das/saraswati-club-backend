require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const createPlatformAdmin = async () => {
  try {
    // 1. Connect to Database
    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI is missing in .env file");
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log("🔌 Connected to MongoDB");

    // 2. Define Super Admin Credentials
    const adminData = {
      name: "ClubKhata Super Admin",
      email: "sahildas@gmail.com", // Distinct from club admins
      password: "SahilDas@123", // ⚠️ Change this immediately after login
      isPlatformAdmin: true // 🚀 THE KEY FIELD
    };

    // 3. Check if exists
    const existing = await User.findOne({ email: adminData.email });
    if (existing) {
      console.log(`⚠️ Platform Admin (${adminData.email}) already exists.`);
      
      // Optional: Update existing user to be platform admin if they aren't already
      if (!existing.isPlatformAdmin) {
          existing.isPlatformAdmin = true;
          await existing.save();
          console.log("🔄 Updated existing user to have Platform Admin privileges.");
      }
      
      process.exit();
    }

    // 4. Hash Password
    const hashed = await bcrypt.hash(adminData.password, 10);

    // 5. Create User
    await User.create({
      name: adminData.name,
      email: adminData.email,
      password: hashed,
      isPlatformAdmin: true,
      // personalEmail: "", // Optional
    });

    console.log("✅ Platform Admin created successfully!");
    console.log(`📧 Email: ${adminData.email}`);
    console.log(`🔑 Password: ${adminData.password}`);
    
    process.exit();
  } catch (err) {
    console.error("❌ Error creating Platform Admin:", err);
    process.exit(1);
  }
};

createPlatformAdmin();