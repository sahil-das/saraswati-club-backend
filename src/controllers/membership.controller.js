const User = require("../models/User");
const Membership = require("../models/Membership");
const bcrypt = require("bcryptjs");
const FestivalYear = require("../models/FestivalYear");
const Subscription = require("../models/Subscription");
const MemberFee = require("../models/MemberFee");
const mongoose = require("mongoose");
const { logAction } = require("../utils/auditLogger");
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
    // ✅ FIX: Safely access the name
    const memberName = user ? user.name : "Unknown Member";
    // ✅ LOG: MEMBER ADDED
    await logAction({
      req,
      action: "MEMBER_ADDED",
      target: `New Member: ${memberName}`,
      details: { email, role: role || "member" }
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

    // 1. Find Member first to get Name (Need to populate 'user' to get the name/email)
    const memberToDelete = await Membership.findOne({ _id: membershipId, club: clubId })
      .populate("user", "name email");

    if (!memberToDelete) {
      return res.status(404).json({ message: "Member not found" });
    }

    // 2. Delete the Membership
    await Membership.findByIdAndDelete(membershipId);

    // ✅ LOG: MEMBER REMOVED (Fixed Action & Variables)
    await logAction({
      req,
      action: "MEMBER_REMOVED",
      target: `Removed: ${memberToDelete.user?.name || "Unknown"}`,
      details: { 
        email: memberToDelete.user?.email,
        role: memberToDelete.role 
      }
    });

    res.json({ success: true, message: "Member removed from club" });
  } catch (err) {
    console.error(err);
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
    const { role } = req.body; 
    const { clubId } = req.user;

    // 🔒 1. Security: Only Admins can do this
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only Admins can change roles." });
    }

    // 🔒 2. Prevent removing the LAST admin
    if (role !== "admin") {
      const adminCount = await Membership.countDocuments({ club: clubId, role: "admin" });
      if (adminCount <= 1) {
        const targetMember = await Membership.findById(membershipId);
        if (targetMember && targetMember.role === "admin") {
           return res.status(400).json({ message: "Cannot demote the last admin." });
        }
      }
    }

    // 3. Update the Role and POPULATE user details immediately
    const updatedMember = await Membership.findOneAndUpdate(
      { _id: membershipId, club: clubId },
      { role: role },
      { new: true }
    ).populate("user", "name"); // 👈 Ensure we fetch the name

    if (!updatedMember) return res.status(404).json({ message: "Member not found" });

    // ✅ FIX: Safely access the name
    const memberName = updatedMember.user ? updatedMember.user.name : "Unknown Member";

    // ✅ LOG: ROLE CHANGE
    await logAction({
      req,
      action: "ROLE_UPDATED",
      target: `Role Change: ${memberName}`,
      details: { newRole: role }
    });

    res.json({ success: true, message: "Role updated", data: updatedMember });

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
        data: { 
          totalPaid: 0, 
          totalDue: 0, 
          festivalChandaTotal: 0,
          frequency: "none" 
        } 
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

    // 4. ✅ Calculate Total Festival Chanda (MemberFee)
    const chandaStats = await MemberFee.aggregate([
      { 
        $match: { 
          club: activeYear.club, // Ensure same club
          year: activeYear._id,  // Ensure active year
          user: new mongoose.Types.ObjectId(userId) // Ensure current user
        } 
      },
      { 
        $group: { 
          _id: null, 
          total: { $sum: "$amount" } 
        } 
      }
    ]);
    const festivalChandaTotal = chandaStats[0]?.total || 0;

    // 5. Return Data
    res.json({
      success: true,
      data: {
        cycleName: activeYear.name,
        frequency: activeYear.subscriptionFrequency, // ✅ Send Frequency
        totalPaid: sub ? sub.totalPaid : 0,
        totalDue: sub ? sub.totalDue : 0,
        festivalChandaTotal, // ✅ Send Chanda Total
        role: membership.role,
        joinedAt: membership.createdAt
      }
    });

  } catch (err) {
    console.error("MyStats Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};