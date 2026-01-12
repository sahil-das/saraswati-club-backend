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
    const members = await Membership.find({ club: clubId,
      isDeleted: { $ne: true }
     })
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
 * @desc Add a NEW Member (Handles New Users + Restoring Soft Deleted Members)
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

    // 1. Check or Create User
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

    // 2. Check for Existing Membership (Active OR Deleted)
    const existingMembership = await Membership.findOne({ user: user._id, club: clubId });

    if (existingMembership) {
      // ✅ FIX: Check if they were previously removed (Soft Deleted)
      if (existingMembership.isDeleted) {
          // --- RESTORE LOGIC ---
          existingMembership.isDeleted = false;
          existingMembership.status = "active";
          existingMembership.role = role || "member";
          await existingMembership.save();

          await logAction({
              req,
              action: "MEMBER_RESTORED",
              target: `Member Re-joined: ${name}`,
              details: { systemId: email, role }
          });

          return res.status(201).json({ 
              success: true, 
              message: "Member account restored successfully", 
              data: existingMembership 
          });
      }

      // If they exist and are NOT deleted, block duplicate
      return res.status(400).json({ message: "User is already a member" });
    }

    // 3. Create NEW Membership (If never existed)
    const newMembership = await Membership.create({
      user: user._id,
      club: clubId,
      role: role || "member",
      status: "active",
      isDeleted: false // Explicitly set false
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
 * @desc Remove a member from the club (Soft Delete)
 */
exports.removeMember = async (req, res) => {
  try {
    // 1. Check Permissions
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access Denied. Only Admins can remove members." });
    }

    const { id: membershipId } = req.params;
    const { clubId } = req.user;

    // 2. Find Member to delete
    const memberToDelete = await Membership.findOne({ _id: membershipId, club: clubId })
      .populate("user", "name email");

    if (!memberToDelete) {
      return res.status(404).json({ message: "Member not found" });
    }

    // 🛑 3. SAFETY CHECK: Prevent Removing Last Admin
    if (memberToDelete.role === "admin") {
        // Count active admins only
        const adminCount = await Membership.countDocuments({ 
            club: clubId, 
            role: "admin",
            isDeleted: { $ne: true } // Ensure we don't count already deleted admins
        });

        if (adminCount <= 1) {
            return res.status(400).json({ message: "Cannot remove the last admin. Promote another member first." });
        }
    }

    // ✅ 4. SOFT DELETE (The Fix)
    // Instead of deleting the record, we mark it as deleted and inactive.
    // This preserves the link for historical Archive reports.
    await Membership.findByIdAndUpdate(membershipId, { 
        isDeleted: true, 
        status: 'inactive' 
    });

    // 5. Log Action
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
    console.error("Remove Member Error:", err);
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

    // 1. Check Permissions
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only Admins can change roles." });
    }

    // 🛑 2. SAFETY CHECK: Prevent Demoting Last Admin
    // If the new role is NOT admin (i.e. demotion to 'member')
    if (role !== "admin") {
      const targetMember = await Membership.findById(membershipId);
      
      // If we are trying to demote an existing admin...
      if (targetMember && targetMember.role === "admin") {
          const adminCount = await Membership.countDocuments({ club: clubId, role: "admin" });
          
          // ...and they are the only one left
          if (adminCount <= 1) {
             return res.status(400).json({ message: "Cannot demote the last admin. Promote someone else first." });
          }
      }
    }

    // 3. Update Role
    const updatedMember = await Membership.findOneAndUpdate(
      { _id: membershipId, club: clubId },
      { role: role },
      { new: true }
    ).populate("user", "name"); 

    if (!updatedMember) return res.status(404).json({ message: "Member not found" });

    const memberName = updatedMember.user ? updatedMember.user.name : "Unknown Member";

    // 4. Log Action
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