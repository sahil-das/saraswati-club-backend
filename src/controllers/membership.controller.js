const User = require("../models/User");
const Membership = require("../models/Membership");
const bcrypt = require("bcryptjs");
const FestivalYear = require("../models/FestivalYear");
const Subscription = require("../models/Subscription");
/**const FestivalYear = require("../models/FestivalYear");
const Subscription = require("../models/Subscription");
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
    // 🔒 SECURITY CHECK: Only Admins can add members
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access Denied. Only Admins can add members." });
    }
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
    // 🔒 SECURITY CHECK: Only Admins can remove members
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access Denied. Only Admins can remove members." });
    }
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

/**
 * @route PUT /api/v1/members/:id/role
 * @desc Change a member's role (e.g. Member -> Admin)
 */
exports.updateRole = async (req, res) => {
  try {
    const { id: membershipId } = req.params;
    const { role } = req.body; // "admin" or "member"
    const { clubId } = req.user;

    // 🔒 1. Security: Only Admins can do this
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only Admins can change roles." });
    }

    // 🔒 2. Prevent removing the LAST admin
    if (role !== "admin") {
      const adminCount = await Membership.countDocuments({ club: clubId, role: "admin" });
      if (adminCount <= 1) {
        // Check if the user being demoted is actually an admin
        const targetMember = await Membership.findById(membershipId);
        if (targetMember && targetMember.role === "admin") {
           return res.status(400).json({ message: "Cannot demote the last admin." });
        }
      }
    }

    // 3. Update the Role
    const updatedMember = await Membership.findOneAndUpdate(
      { _id: membershipId, club: clubId },
      { role: role },
      { new: true }
    );

    if (!updatedMember) return res.status(404).json({ message: "Member not found" });

    res.json({ success: true, message: "Role updated successfully", data: updatedMember });

  } catch (err) {
    console.error("Update Role Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @desc Get Stats for Current Logged In Member
 * @route GET /api/v1/members/my-stats
 */
exports.getMyStats = async (req, res) => {
  try {
    const { clubId, id: userId } = req.user;

    // 1. Get Active Year
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    
    // Default stats if no year exists
    if (!activeYear) {
      return res.json({ 
        success: true, 
        data: { totalPaid: 0, totalDue: 0, attendance: 0 } 
      });
    }

    // 2. Find Membership ID
    const membership = await Membership.findOne({ user: userId, club: clubId });
    if (!membership) {
       return res.status(404).json({ message: "Membership not found" });
    }

    // 3. Find Subscription (Payment Record)
    const sub = await Subscription.findOne({ 
      club: clubId, 
      year: activeYear._id, 
      member: membership._id 
    });

    // 4. Return Data
    res.json({
      success: true,
      data: {
        totalPaid: sub ? sub.totalPaid : 0,
        totalDue: sub ? sub.totalDue : 0,
        role: membership.role,
        joinedAt: membership.createdAt
      }
    });

  } catch (err) {
    console.error("MyStats Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};