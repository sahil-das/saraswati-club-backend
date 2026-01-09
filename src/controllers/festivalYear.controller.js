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
  
  // Safe getters for money fields
  const getVal = (field) => yearDoc.get ? yearDoc.get(field, null, { getters: false }) : obj[field];
  
  obj.amountPerInstallment = toClient(getVal('amountPerInstallment') || 0);
  obj.openingBalance = toClient(getVal('openingBalance') || 0);
  obj.closingBalance = toClient(getVal('closingBalance') || 0);
  obj.targetAmount = toClient(getVal('targetAmount') || 0); // Legacy support if field exists

  return obj;
};

// ✅ ADDED: session parameter for safety
const checkOverlap = async (clubId, startDate, endDate, excludeId = null, session = null) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const query = {
    club: clubId,
    // Overlap Logic: (StartA <= EndB) and (EndA >= StartB)
    startDate: { $lte: end },
    endDate: { $gte: start }
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return await FestivalYear.findOne(query).session(session);
};

function generateInstallments(count, amount, startNumber = 1) {
    const arr = [];
    for (let i = 0; i < count; i++) {
        arr.push({
            number: startNumber + i,
            amountExpected: amount, // Float: Schema setter will convert to Integer
            isPaid: false,
            paidDate: null,
            collectedBy: null
        });
    }
    return arr;
}

// ✅ ADDED: session parameter for safety
async function adjustSubscriptions({ yearId, newFreq, newTotal, newAmount }, session) {
    const subs = await Subscription.find({ year: yearId }).session(session);
    if (subs.length === 0) return;

    for (const sub of subs) {
        let installments = sub.installments;

        // 1. Handle Frequency Change to "None"
        if (newFreq === 'none') {
            installments = [];
        } 
        // 2. Handle Switch from "None" to Weekly/Monthly
        else if (installments.length === 0 && newFreq !== 'none') {
            installments = generateInstallments(newTotal, newAmount);
        }
        // 3. Handle Adjustment of Existing Installments
        else {
            // A. Increase Weeks
            if (newTotal > installments.length) {
                const startNum = installments.length + 1;
                const addedCount = newTotal - installments.length;
                const newItems = generateInstallments(addedCount, newAmount, startNum);
                installments = [...installments, ...newItems];
            }
            // B. Reduce Weeks
            else if (newTotal < installments.length) {
                // Safety: Check if we are deleting paid installments
                const removed = installments.slice(newTotal);
                const hasPaidRemoved = removed.some(inst => inst.isPaid);
                
                // If paid items are being removed, we cannot proceed (Data Loss Risk)
                if (hasPaidRemoved) {
                    throw new Error("Cannot reduce installments. Some members have already paid for the weeks you are trying to remove.");
                }

                installments = installments.slice(0, newTotal);
            }

            // C. Update Amount for ALL pending/future installments
            installments.forEach(inst => {
                if (!inst.isPaid) {
                    inst.amountExpected = newAmount;
                }
            });
        }

        // Recalculate Totals
        // Note: newAmount is in Rupees (float). Sub schema setters handle conversion.
        const paidCount = installments.filter(i => i.isPaid).length;
        
        const dueCount = installments.length - paidCount;
        
        sub.installments = installments;
        sub.totalDue = dueCount * newAmount; 
        
        // Recalculate totalPaid based on integer values in DB if possible, or re-sum
        const newTotalPaid = installments.reduce((sum, i) => sum + (i.isPaid ? i.amountExpected : 0), 0);
        sub.totalPaid = newTotalPaid;

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

    // 2. Check Overlaps (Pass session)
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
       // Calculate actual cash-in-hand from previous year
       const calcBal = await calculateBalance(previousYear._id, previousYear.openingBalance);
       finalOpeningBalance = Number(calcBal) || 0;

       // Save the closing balance to the old year record
       await FestivalYear.updateOne(
           { _id: previousYear._id }, 
           { closingBalance: finalOpeningBalance },
           { session }
       );
    } else {
       // First year ever? User can provide manual opening balance
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
      subscriptionFrequency, totalInstallments, amountPerInstallment 
    } = req.body;

    const yearDoc = await FestivalYear.findOne({ _id: id, club: clubId }).session(session);
    if (!yearDoc) throw new Error("Year not found");
    if (yearDoc.isClosed) throw new Error("Cannot update a closed year.");

    // 1. Validate Dates & Overlaps
    let newStart = yearDoc.startDate;
    let newEnd = yearDoc.endDate;

    if (startDate) newStart = new Date(startDate);
    if (endDate) newEnd = new Date(endDate);

    if (newStart >= newEnd) throw new Error("Start Date must be before End Date.");

    if (startDate || endDate) {
        // Pass session to checkOverlap
        const conflict = await checkOverlap(clubId, newStart, newEnd, id, session);
        if (conflict) {
            throw new Error(`Dates overlap with existing year: '${conflict.name}'`);
        }
    }

    // 2. Prepare Config Changes
    const currentFreq = yearDoc.subscriptionFrequency;
    const currentTotal = yearDoc.totalInstallments;
    // Get raw integer
    const currentAmountRaw = yearDoc.get('amountPerInstallment', null, { getters: false });
    const currentAmount = currentAmountRaw / 100; // Convert integer to float for comparison

    const newFreq = subscriptionFrequency || currentFreq;
    const newTotal = Number(totalInstallments) || currentTotal;
    
    let newAmount = currentAmount;
    if (amountPerInstallment !== undefined && amountPerInstallment !== "") {
        newAmount = Number(amountPerInstallment);
    }

    const freqChanged = newFreq !== currentFreq;
    const durationChanged = newTotal !== currentTotal;
    const amountChanged = Math.abs(newAmount - currentAmount) > 0.001;

    // 3. Safety Checks for Structural Changes
    // Need to check this with session to ensure no one is paying RIGHT NOW
    const subsWithPayments = await Subscription.countDocuments({
        year: id,
        "installments.isPaid": true
    }).session(session);

    if (freqChanged && subsWithPayments > 0) {
        throw new Error(`Cannot change Frequency (Weekly/Monthly) because payments have already been recorded.`);
    }

    if (durationChanged && newTotal < currentTotal) {
        // If reducing weeks, ensure no payments exist in the truncated period
        const conflict = await Subscription.findOne({
            year: id,
            installments: {
                $elemMatch: {
                    number: { $gt: newTotal }, 
                    isPaid: true
                }
            }
        }).session(session);

        if (conflict) throw new Error(`Cannot reduce installments to ${newTotal}. Payments exist for later weeks.`);
    }

    // 4. Apply Updates
    if (name) yearDoc.name = name;
    yearDoc.startDate = newStart;
    yearDoc.endDate = newEnd;
    yearDoc.subscriptionFrequency = newFreq;
    yearDoc.totalInstallments = newTotal;
    yearDoc.amountPerInstallment = newAmount; 

    // 5. Adjust Subscriptions if needed
    if (freqChanged || durationChanged || amountChanged) {
        // Pass session to helper
        await adjustSubscriptions({
            yearId: id,
            newFreq,
            newTotal,
            newAmount
        }, session);
    }

    await yearDoc.save({ session });
    
    await logAction({ 
        req, 
        action: "YEAR_UPDATED", 
        target: `Settings: ${yearDoc.name}`, 
        details: { amount: newAmount, frequency: newFreq } 
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
 * @desc Manually Close a Year (Protected with Transaction)
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
    
        // Calculate Final Balance
        // calculateBalance is an aggregation, so it doesn't take session easily unless refactored,
        // but it is a read-only op on other collections.
        // However, to be strictly consistent, we should ideally run it in session, 
        // but since it aggregates other collections, the risk is lower. 
        // We will proceed with standard call.
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