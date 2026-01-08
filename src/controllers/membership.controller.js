const User = require("../models/User");
const Membership = require("../models/Membership");
const bcrypt = require("bcryptjs");
const FestivalYear = require("../models/FestivalYear");
const Subscription = require("../models/Subscription");
const MemberFee = require("../models/MemberFee");
const mongoose = require("mongoose");
const { logAction } = require("../utils/auditLogger");
const { toClient } = require("../utils/mongooseMoney"); // 👈 IMPORT

/**
 * @route GET /api/v1/members
 * @desc Get all members of the CURRENT club
 */
exports.getAllMembers = async (req, res) => {
  try {
    // 1. Get the Club ID AND the Role of the person asking
    const { clubId, role: requesterRole } = req.user;

    // 2. Fetch memberships with User details
    // We fetch all fields from DB, but we will filter them below
    const members = await Membership.find({ club: clubId })
      .populate("user", "name email phone personalEmail") 
      .sort({ joinedAt: -1 });

    // 3. Format data (Enforce Privacy)
    const formattedMembers = members.map(m => {
      // Base Data: Visible to EVERYONE
      const memberData = {
        membershipId: m._id,
        userId: m.user ? m.user._id : null,
        name: m.user ? m.user.name : "Unknown",
        email: m.user ? m.user.email : "", // System Login ID (@club.com) is safe to show
        role: m.role,
        status: m.status,
        joinedAt: m.joinedAt
      };

      // Sensitive Data: Visible ONLY to ADMINS
      if (requesterRole === 'admin') {
        memberData.personalEmail = m.user ? m.user.personalEmail : ""; // ✅ Correct casing
        memberData.phone = m.user ? m.user.phone : "";
      }

      return memberData;
    });

    res.json({ success: true, data: formattedMembers });
  } catch (err) {
    console.error("Get Members Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
/**
 * @route POST /api/v1/members
 * @desc Add a NEW Member (Supports System ID + Personal Email)
 */
exports.addMember = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access Denied. Admins only." });
    }
    
    const { name, email, personalEmail, phone, role, password } = req.body;
    const { clubId } = req.user;

    if (!email || !name) {
      return res.status(400).json({ message: "Name and System Login ID are required" });
    }

    let user = await User.findOne({ email });

    if (!user) {
      if (!password) return res.status(400).json({ message: "Password is required" });
      
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      user = await User.create({
        name,
        email,          
        personalEmail,  
        phone,
        password: hashedPassword
      });
    }

    const existingMembership = await Membership.findOne({ user: user._id, club: clubId });
    if (existingMembership) {
      return res.status(400).json({ message: "User is already a member" });
    }

    const newMembership = await Membership.create({
      user: user._id,
      club: clubId,
      role: role || "member",
      status: "active"
    });

    await logAction({
      req,
      action: "MEMBER_ADDED",
      target: `New Member: ${name}`,
      details: { systemId: email, personalEmail, role }
    });

    res.status(201).json({ success: true, message: "Member added", data: newMembership });

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
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access Denied. Only Admins can remove members." });
    }
    const { id: membershipId } = req.params;
    const { clubId } = req.user;

    const memberToDelete = await Membership.findOne({ _id: membershipId, club: clubId })
      .populate("user", "name email");

    if (!memberToDelete) {
      return res.status(404).json({ message: "Member not found" });
    }

    await Membership.findByIdAndDelete(membershipId);

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

    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only Admins can change roles." });
    }

    if (role !== "admin") {
      const adminCount = await Membership.countDocuments({ club: clubId, role: "admin" });
      if (adminCount <= 1) {
        const targetMember = await Membership.findById(membershipId);
        if (targetMember && targetMember.role === "admin") {
           return res.status(400).json({ message: "Cannot demote the last admin." });
        }
      }
    }

    const updatedMember = await Membership.findOneAndUpdate(
      { _id: membershipId, club: clubId },
      { role: role },
      { new: true }
    ).populate("user", "name"); 

    if (!updatedMember) return res.status(404).json({ message: "Member not found" });

    const memberName = updatedMember.user ? updatedMember.user.name : "Unknown Member";

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

    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    
    // Default stats if no year exists
    if (!activeYear) {
      return res.json({ 
        success: true, 
        data: { 
          totalPaid: "0.00", 
          totalDue: "0.00", 
          festivalChandaTotal: "0.00",
          frequency: "none" 
        } 
      });
    }

    const membership = await Membership.findOne({ user: userId, club: clubId });
    if (!membership) {
       return res.status(404).json({ message: "Membership not found" });
    }

    const sub = await Subscription.findOne({ 
      club: clubId, 
      year: activeYear._id, 
      member: membership._id 
    });
    
    // Retrieve raw integers
    const rawTotalPaid = sub ? (sub.get('totalPaid', null, { getters: false }) || 0) : 0;
    const rawTotalDue = sub ? (sub.get('totalDue', null, { getters: false }) || 0) : 0;

    // 4. Calculate Total Festival Chanda (MemberFee)
    const chandaStats = await MemberFee.aggregate([
      { 
        $match: { 
          club: activeYear.club, 
          year: activeYear._id, 
          user: new mongoose.Types.ObjectId(userId) 
        } 
      },
      { 
        $group: { 
          _id: null, 
          total: { $sum: "$amount" } // Integer Sum
        } 
      }
    ]);
    const rawChanda = chandaStats[0]?.total || 0;

    res.json({
      success: true,
      data: {
        cycleName: activeYear.name,
        frequency: activeYear.subscriptionFrequency, 
        // 💰 Format to Strings
        totalPaid: toClient(rawTotalPaid),
        totalDue: toClient(rawTotalDue),
        festivalChandaTotal: toClient(rawChanda), 
        role: membership.role,
        joinedAt: membership.createdAt
      }
    });

  } catch (err) {
    console.error("MyStats Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};