const User = require("../models/User");
const bcrypt = require("bcryptjs");

exports.list = async (req, res) => {
  const members = await User.find({ role: "member" }).select("-password");
  res.json({ success: true, data: members });
};

exports.create = async (req, res) => {
  const { email, password, role } = req.body;

  const exists = await User.findOne({ email });
  if (exists) {
    return res.status(400).json({ message: "User already exists" });
  }

  const hashed = await bcrypt.hash(password, 10);

  await User.create({
    email,
    password: hashed,
    role,
  });

  res.json({ message: "Member created" });
};

exports.details = async (req, res) => {
  const user = await User.findById(req.params.id).select("-password");
  res.json(user);
};
