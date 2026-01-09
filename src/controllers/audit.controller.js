const AuditLog = require("../models/AuditLog");
const FestivalYear = require("../models/FestivalYear");
const mongoose = require("mongoose");
const logger = require("../utils/logger");
exports.getLogs = async (req, res) => {
  try {
    let { 
      page = 1, 
      limit = 20, 
      action, 
      startDate, 
      endDate, 
      actorId, 
      festivalYearId, 
      lastMonths 
    } = req.query;
    
    // 1. Sanitize Pagination
    page = Math.max(1, parseInt(page) || 1);
    limit = Math.min(100, Math.max(1, parseInt(limit) || 20)); 

    const query = { club: req.user.clubId };

    // 2. Action & Actor Filters
    if (action && action !== "ALL") query.action = action;
    if (actorId && mongoose.isValidObjectId(actorId)) query.actor = actorId;

    // 3. DATE FILTERING STRATEGY
    let dateFilter = {};
    const MAX_DAYS_ALLOWED = 90; // 🛑 3 Months Limit

    // SCENARIO A: Filter by Festival Year (High Priority & Safe)
    // We allow > 3 months here because a "Year" is a known, finite container.
    if (festivalYearId && mongoose.isValidObjectId(festivalYearId)) {
        const fYear = await FestivalYear.findById(festivalYearId);
        if (fYear) {
            dateFilter = { 
                $gte: fYear.startDate, 
                $lte: fYear.endDate 
            };
        }
    }
    // SCENARIO B: Manual Dates or "Last X Months"
    else {
        let start, end;

        // Option 1: "Last X Months"
        if (lastMonths) {
            const months = parseInt(lastMonths);
            if (months > 3) {
                 return res.status(400).json({ message: "You can view maximum 3 months of logs at a time. Please select a specific Festival Cycle to see more." });
            }
            start = new Date();
            start.setMonth(start.getMonth() - months);
            start.setHours(0, 0, 0, 0);
            end = new Date();
        } 
        // Option 2: Manual Start/End
        else {
            // Default to Last 1 Month if nothing provided
            if (!startDate) {
                start = new Date();
                start.setMonth(start.getMonth() - 1); // Default 1 month
                start.setHours(0, 0, 0, 0);
            } else {
                start = new Date(startDate);
            }

            if (!endDate) {
                end = new Date(); // Now
            } else {
                end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
            }
        }

        // 🛡️ SECURITY CHECK: Enforce 90 Day Limit
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > MAX_DAYS_ALLOWED) {
            return res.status(400).json({ 
                message: `Date range (${diffDays} days) exceeds the 3-month limit. Please select a specific Festival Cycle or narrow your dates.` 
            });
        }

        // Apply validated dates
        dateFilter = { $gte: start, $lte: end };
    }

    // Apply the constructed date filter to query
    if (Object.keys(dateFilter).length > 0) {
        query.createdAt = dateFilter;
    }

    // 4. Execute Query
    const logs = await AuditLog.find(query)
      .populate("actor", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await AuditLog.countDocuments(query);

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (err) {
    logger.error("Audit Log Fetch Error", { 
      error: err.message, 
      stack: err.stack,
      clubId: req.user.clubId,
      query: req.query 
    });
    res.status(500).json({ message: "Server error fetching logs" });
  }
};