require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const email = "admin@clubname.com";
    const password = "password123";

    const existing = await User.findOne({ email });
    if (existing) {
      console.log("Admin already exists");
      process.exit();
    }

    const hashed = await bcrypt.hash(password, 10);

    await User.create({
      email,
      password: hashed,
      role: "admin",
    });

    console.log("✅ Admin user created");
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
