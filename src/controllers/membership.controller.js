const User = require("../models/User");
const Membership = require("../models/Membership");
const bcrypt = require("bcryptjs");

/**
 * @route GET /api/v1/members
 * @desc Get all members of the CURRENT club
 */
exports.getAllMembers = async (req, res) => {
  try {
    const { clubId } = req.user;

    // Fetch memberships and join with User details
    const members = await Membership.find({ club: clubId })
      .populate("user", "name email phone") // Get name/email from User model
      .sort({ joinedAt: -1 });

    // Format data for frontend
    const formattedMembers = members.map(m => ({
      membershipId: m._id,
      userId: m.user._id,
      name: m.user.name,
      email: m.user.email,
      phone: m.user.phone,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt
    }));

    res.json({ success: true, data: formattedMembers });
  } catch (err) {
    console.error("Get Members Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @route POST /api/v1/members
 * @desc Add a NEW Member to the club
 * (Creates User if not exists, then links Membership)
 */
exports.addMember = async (req, res) => {
  try {
    const { name, email, phone, role, password } = req.body;
    const { clubId } = req.user;

    if (!email || !name) {
      return res.status(400).json({ message: "Name and Email are required" });
    }

    // 1. Check if User already exists Globally
    let user = await User.findOne({ email });

    if (!user) {
      // Create new Global User
      if (!password) {
        return res.status(400).json({ message: "Password is required for new users" });
      }
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      user = await User.create({
        name,
        email,
        phone,
        password: hashedPassword
      });
    }

    // 2. Check if already a member of THIS club
    const existingMembership = await Membership.findOne({ 
      user: user._id, 
      club: clubId 
    });

    if (existingMembership) {
      return res.status(400).json({ message: "User is already a member of this club" });
    }

    // 3. Create Membership Link
    const newMembership = await Membership.create({
      user: user._id,
      club: clubId,
      role: role || "member",
      status: "active"
    });

    res.status(201).json({ 
      success: true, 
      message: "Member added successfully", 
      data: newMembership 
    });

  } catch (err) {
    console.error("Add Member Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @route DELETE /api/v1/members/:id
 * @desc Remove a member from the club (Delete Membership)
 */
exports.removeMember = async (req, res) => {
  try {
    const { id: membershipId } = req.params;
    const { clubId } = req.user;

    // Delete the LINK, not the User
    const result = await Membership.findOneAndDelete({ 
      _id: membershipId, 
      club: clubId 
    });

    if (!result) return res.status(404).json({ message: "Member not found" });

    res.json({ success: true, message: "Member removed from club" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};