const mongoose = require("mongoose");
const FestivalYear = require("../models/FestivalYear");
const Subscription = require("../models/Subscription");
const calculateBalance = require("../utils/calculateBalance"); 
const { logAction } = require("../utils/auditLogger");
const { toClient } = require("../utils/mongooseMoney"); 

// ==========================================
// HELPERS (With Transaction Support)
// ==========================================

const formatYear = (yearDoc) => {
  if (!yearDoc) return null;
  const obj = yearDoc.toObject ? yearDoc.toObject() : yearDoc;
  const getVal = (field) => yearDoc.get ? yearDoc.get(field, null, { getters: false }) : obj[field];
  
  obj.amountPerInstallment = toClient(getVal('amountPerInstallment') || 0);
  obj.openingBalance = toClient(getVal('openingBalance') || 0);
  obj.closingBalance = toClient(getVal('closingBalance') || 0);
  return obj;
};

// ✅ ADDED: session parameter for safety
const checkOverlap = async (clubId, startDate, endDate, excludeId = null, session = null) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const query = {
    club: clubId,
    startDate: { $lte: end },
    endDate: { $gte: start }
  };
  if (excludeId) query._id = { $ne: excludeId };
  return await FestivalYear.findOne(query).session(session);
};

function generateInstallments(count, amount, startNumber = 1) {
    const arr = [];
    for (let i = 0; i < count; i++) {
        arr.push({
            number: startNumber + i,
            amountExpected: amount,
            isPaid: false,
            paidDate: null,
            collectedBy: null
        });
    }
    return arr;
}

// ==========================================
// 1. CORE HELPER: Adjust Subscriptions Safely
// ==========================================
async function adjustSubscriptions({ yearId, newTotal, newAmount }, session) {
    // 1. Safety: Ensure newAmount is a number
    const safeNewAmount = Number(newAmount) || 0; 

    const subs = await Subscription.find({ year: yearId }).session(session);
    if (subs.length === 0) return;

    for (const sub of subs) {
        let installments = sub.installments;

        // A. Handle Array Size (Add/Remove Weeks)
        if (newTotal > installments.length) {
            // Add new weeks
            const startNum = installments.length + 1;
            const addedCount = newTotal - installments.length;
            const newItems = generateInstallments(addedCount, safeNewAmount, startNum);
            installments = [...installments, ...newItems];
        } 
        else if (newTotal < installments.length) {
            installments = installments.slice(0, newTotal);
        }

        // B. THE FIX: Robust Calculation Logic
        let calculatedTotalPaid = 0;
        let calculatedTotalDue = 0;

        installments.forEach(inst => {
            // 1. Safely extract existing amount
            // Use .get() if available to handle Mongoose getters, otherwise direct access
            let currentValRaw;
            if (typeof inst.get === 'function') {
                currentValRaw = inst.get('amountExpected', null, { getters: true });
            } else {
                currentValRaw = inst.amountExpected;
            }

            // 2. FORCE Number type (Prevent NaN crash)
            const currentValSafe = Number(currentValRaw);
            const existingAmount = isNaN(currentValSafe) ? 0 : currentValSafe;

            if (inst.isPaid) {
                // ✅ PAST (Paid): Keep history. Add EXISTING value.
                calculatedTotalPaid += existingAmount;
            } else {
                // ✅ FUTURE (Unpaid): Update to NEW price.
                inst.amountExpected = safeNewAmount;
                // Add NEW value
                calculatedTotalDue += safeNewAmount;
            }
        });

        // C. Apply Logic (Safe Assignment)
        sub.installments = installments;
        
        // Final NaN check before assignment
        sub.totalPaid = isNaN(calculatedTotalPaid) ? 0 : calculatedTotalPaid;
        sub.totalDue = isNaN(calculatedTotalDue) ? 0 : calculatedTotalDue;

        sub.markModified('installments');
        await sub.save({ session });
    }
}
// ==========================================
// CONTROLLERS
// ==========================================

/**
 * @desc Start a New Festival Year
 * @route POST /api/v1/years
 */
exports.createYear = async (req, res) => {
  let session;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const { 
      name, startDate, endDate, openingBalance, 
      subscriptionFrequency, totalInstallments, amountPerInstallment 
    } = req.body;
    
    const { clubId, id: userId } = req.user;

    if (!clubId) throw new Error("Club ID missing in context.");

    // 1. Validate Dates
    if (new Date(startDate) >= new Date(endDate)) {
        throw new Error("Start Date must be before End Date.");
    }

    // 2. Check Overlaps
    const conflict = await checkOverlap(clubId, startDate, endDate, null, session);
    if (conflict) {
        throw new Error(`Dates overlap with existing year: '${conflict.name}'`);
    }

    // 3. Find and Close Previous Active Year
    let previousYear = await FestivalYear.findOneAndUpdate(
        { club: clubId, isActive: true },
        { isActive: false, isClosed: true },
        { new: true, session }
    );

    // 4. If no active year, find the chronologically last year
    if (!previousYear) {
        previousYear = await FestivalYear.findOne({ club: clubId })
            .sort({ endDate: -1 }) 
            .session(session);
    }

    // 5. Calculate Opening Balance
    let finalOpeningBalance = 0;
    if (previousYear) {
       const calcBal = await calculateBalance(previousYear._id, previousYear.openingBalance);
       finalOpeningBalance = Number(calcBal) || 0;

       await FestivalYear.updateOne(
           { _id: previousYear._id }, 
           { closingBalance: finalOpeningBalance },
           { session }
       );
    } else {
       if (openingBalance !== undefined && openingBalance !== "") {
           finalOpeningBalance = Number(openingBalance);
       }
    }

    // 6. Config Setup
    const frequency = subscriptionFrequency || "weekly";
    const finalInstallments = frequency === "monthly" ? 12 : (Number(totalInstallments) || 52);
    const finalAmount = frequency === 'none' ? 0 : (Number(amountPerInstallment) || 0);

    // 7. Create
    const [newYear] = await FestivalYear.create([{
      club: clubId,
      name,
      startDate,
      endDate,
      openingBalance: finalOpeningBalance, 
      subscriptionFrequency: frequency,
      totalInstallments: finalInstallments,
      amountPerInstallment: finalAmount,
      isActive: true, 
      isClosed: false,
      createdBy: userId
    }], { session });

    // 8. Audit Log
    await logAction({
      req,
      action: "YEAR_STARTED",
      target: `New Cycle: ${name}`,
      details: { 
        openingBalance: finalOpeningBalance, 
        frequency: frequency,
        previousYear: previousYear ? previousYear.name : "None"
      }
    });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: `Cycle '${name}' started. Opening Balance: ₹${finalOpeningBalance}`,
      year: formatYear(newYear)
    });

  } catch (err) {
    if (session) {
        await session.abortTransaction();
        session.endSession();
    }
    console.error("Create Year Error:", err);
    res.status(400).json({ message: err.message || "Server Error" });
  }
};

/**
 * @desc Get All Years
 * @route GET /api/v1/years
 */
exports.getAllYears = async (req, res) => {
    try {
      const { clubId } = req.user;
      const years = await FestivalYear.find({ club: clubId }).sort({ endDate: -1 });
      const formattedYears = years.map(y => formatYear(y));
      res.json({ success: true, data: formattedYears });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ message: "Server error" }); 
    }
};

/**
 * @desc Get Active Year
 * @route GET /api/v1/years/active
 */
exports.getActiveYear = async (req, res) => {
    try {
      const { clubId } = req.user;
      const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
      
      if (!activeYear) {
          return res.status(200).json({ success: true, data: null });
      }
      res.json({ success: true, data: formatYear(activeYear) });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ message: "Server error" }); 
    }
};

/**
 * @desc Update Year Settings (Protected with Transaction)
 * @route PUT /api/v1/years/:id
 */
exports.updateYear = async (req, res) => {
  let session;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const { id } = req.params;
    const { clubId } = req.user;
    const { 
      name, startDate, endDate, 
      subscriptionFrequency, totalInstallments, amountPerInstallment,
      expenseCategories // 👈 Capture this from request
    } = req.body;

    // 1. Fetch Existing Year
    const yearDoc = await FestivalYear.findOne({ _id: id, club: clubId }).session(session);
    if (!yearDoc) throw new Error("Year not found");
    if (yearDoc.isClosed) throw new Error("Cannot update a closed year.");

    // 2. Setup Config Variables
    const currentFreq = yearDoc.subscriptionFrequency;
    const currentTotal = yearDoc.totalInstallments;
    // Get raw amount (paise) -> float (rupees)
    const currentAmountRaw = yearDoc.get('amountPerInstallment', null, { getters: false });
    const currentAmount = currentAmountRaw ? currentAmountRaw / 100 : 0; 

    const newFreq = subscriptionFrequency || currentFreq;
    
    // 3. Logic for Total Installments
    let newTotal = currentTotal;

    if (newFreq === 'monthly') {
        newTotal = 12; // Force 12 for monthly
    } else if (newFreq === 'none') {
        newTotal = 0;
    } else {
        // Weekly: Use input or keep old
        newTotal = totalInstallments ? Number(totalInstallments) : currentTotal;
    }

    // 4. Logic for Amount
    let newAmount = currentAmount;
    if (amountPerInstallment !== undefined && amountPerInstallment !== "") {
        newAmount = Number(amountPerInstallment);
    }

    // 5. CRITICAL CHECKS
    const hasAnyPayments = await Subscription.exists({ 
        year: id, 
        "installments.isPaid": true 
    }).session(session);

    // Rule: Block Frequency Change if Payments Exist
    if (newFreq !== currentFreq && hasAnyPayments) {
        throw new Error(`Cannot switch from ${currentFreq} to ${newFreq} because payments have already been collected.`);
    }

    // Rule: Weekly Reduction Safety
    if (newFreq === 'weekly' && newTotal < currentTotal) {
        // Find max paid number
        const maxPaidResult = await Subscription.aggregate([
            { $match: { year: new mongoose.Types.ObjectId(id) } },
            { $unwind: "$installments" },
            { $match: { "installments.isPaid": true } },
            { $group: { _id: null, maxNumber: { $max: "$installments.number" } } }
        ]).session(session);

        const maxPaidNumber = maxPaidResult.length > 0 ? maxPaidResult[0].maxNumber : 0;

        if (newTotal < maxPaidNumber) {
            throw new Error(`Cannot reduce weeks to ${newTotal}. Installment #${maxPaidNumber} has already been paid.`);
        }
    }

    // 6. Apply Updates to Year Doc
    if (name) yearDoc.name = name;
    if (startDate) yearDoc.startDate = new Date(startDate);
    if (endDate) yearDoc.endDate = new Date(endDate);
    
    // ✅ Update Categories if provided
    if (expenseCategories && Array.isArray(expenseCategories)) {
        yearDoc.expenseCategories = expenseCategories;
    }
    
    yearDoc.subscriptionFrequency = newFreq;
    yearDoc.totalInstallments = newTotal;
    yearDoc.amountPerInstallment = newAmount;

    // 7. Run the Helper
    await adjustSubscriptions({
        yearId: id,
        newTotal,
        newAmount
    }, session);

    await yearDoc.save({ session });
    
    await logAction({ 
        req, 
        action: "YEAR_UPDATED", 
        target: `Settings: ${yearDoc.name}`, 
        details: { newAmount, newFreq, newTotal } 
    });

    await session.commitTransaction();
    session.endSession();

    res.json({ success: true, data: formatYear(yearDoc), message: "Settings updated successfully." });

  } catch (err) {
    if (session) {
        await session.abortTransaction();
        session.endSession();
    }
    console.error("Update Year Error:", err);
    res.status(400).json({ message: err.message });
  }
};
/**
 * @desc Manually Close a Year
 * @route POST /api/v1/years/:id/close
 */
exports.closeYear = async (req, res) => {
    let session;
    try {
        session = await mongoose.startSession();
        session.startTransaction();

        const { id } = req.params;
        const { clubId } = req.user;
    
        const year = await FestivalYear.findOne({ _id: id, club: clubId }).session(session);
        if (!year) throw new Error("Year not found");
        if (year.isClosed) throw new Error("Year is already closed.");
    
        const finalBalance = await calculateBalance(year._id, year.openingBalance);
    
        year.isActive = false;
        year.isClosed = true;
        year.closingBalance = Number(finalBalance); 
        
        await year.save({ session });
    
        await logAction({ 
            req, 
            action: "YEAR_CLOSED", 
            target: `Closed: ${year.name}`, 
            details: { finalBalance } 
        });

        await session.commitTransaction();
        session.endSession();
    
        res.json({ success: true, message: "Year closed.", data: formatYear(year) });
    } catch (err) {
        if (session) {
            await session.abortTransaction();
            session.endSession();
        }
        console.error("Close Year Error:", err);
        res.status(500).json({ message: "Server Error" });
    }
};