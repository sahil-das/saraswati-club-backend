const mongoose = require("mongoose"); // 👈 FIX: Required for Transactions
const FestivalYear = require("../models/FestivalYear");
const calculateBalance = require("../utils/calculateBalance"); 
const Subscription = require("../models/Subscription");
const { logAction } = require("../utils/auditLogger");
const { toClient } = require("../utils/mongooseMoney"); 

/**
 * 🛠 HELPER: Format Year Object (Int -> String)
 */
const formatYear = (yearDoc) => {
  if (!yearDoc) return null;
  const obj = yearDoc.toObject ? yearDoc.toObject() : yearDoc;
  
  const rawAmount = yearDoc.get ? yearDoc.get('amountPerInstallment', null, { getters: false }) : obj.amountPerInstallment;
  const rawOpening = yearDoc.get ? yearDoc.get('openingBalance', null, { getters: false }) : obj.openingBalance;
  const rawClosing = yearDoc.get ? yearDoc.get('closingBalance', null, { getters: false }) : obj.closingBalance;

  obj.amountPerInstallment = toClient(rawAmount || 0);
  obj.openingBalance = toClient(rawOpening || 0);
  obj.closingBalance = toClient(rawClosing || 0);

  return obj;
};

/**
 * @desc Start a New Festival Year (TRANSACTIONAL)
 * @route POST /api/v1/festival-years
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

    if (!clubId) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: "Missing 'x-club-id' header." });
    }

    // 1. Validate Frequency
    const VALID_FREQUENCIES = ["weekly", "monthly", "none"];
    const frequency = subscriptionFrequency || "weekly";
    if (!VALID_FREQUENCIES.includes(frequency)) throw new Error("Invalid frequency.");

    let finalInstallments = frequency === "monthly" ? 12 : (Number(totalInstallments) || 52);

    // 2. FIND PREVIOUS YEAR (The Critical Fix 🔍)
    let previousYear = null;
    let finalOpeningBalance = 0;

    // A. Priority 1: Check if there is currently an ACTIVE year to close
    previousYear = await FestivalYear.findOneAndUpdate(
        { club: clubId, isActive: true },
        { isActive: false, isClosed: true },
        { new: true, session }
    );

    // B. Priority 2: If no active year, find the LAST CREATED year
    // ❌ OLD BUGGY CODE: .sort({ endDate: -1 }) 
    // ✅ NEW FIXED CODE: .sort({ createdAt: -1 })
    if (!previousYear) {
        previousYear = await FestivalYear.findOne({ club: clubId })
            .sort({ createdAt: -1 }) // Gets the one you added most recently
            .session(session);
    }

    // 3. CALCULATE BALANCE
    if (previousYear) {
       // Calculate balance strictly for the identified previous year
       const calcBal = await calculateBalance(previousYear._id, previousYear.openingBalance);
       const closingRupees = Number(calcBal) || 0;

       // Save Closing Balance to that Previous Year
       await FestivalYear.updateOne(
           { _id: previousYear._id }, 
           { closingBalance: closingRupees },
           { session }
       );

       // Carry forward to New Year
       finalOpeningBalance = closingRupees;

    } else {
       // First year ever? Use manual input
       if (openingBalance !== undefined && openingBalance !== "") {
           finalOpeningBalance = Number(openingBalance);
       }
    }

    // 4. Create New Year
    const newYear = await FestivalYear.create([{
      club: clubId,
      name,
      startDate,
      endDate,
      openingBalance: finalOpeningBalance, 
      subscriptionFrequency: frequency,
      totalInstallments: finalInstallments,
      amountPerInstallment: frequency === 'none' ? 0 : (Number(amountPerInstallment) || 0),
      isActive: true, // New year starts as Active
      isClosed: false,
      createdBy: userId
    }], { session });

    // 5. Audit Log
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
      year: newYear[0]
    });

  } catch (err) {
    if (session) {
        await session.abortTransaction();
        session.endSession();
    }
    console.error("Create Year Error:", err);
    res.status(500).json({ message: err.message });
  }
};
/**
 * @desc Get All Years
 */
exports.getAllYears = async (req, res) => {
    try {
      const years = await FestivalYear.find({ club: req.user.clubId }).sort({ createdAt: -1 });
      const formattedYears = years.map(y => formatYear(y));
      res.json({ success: true, data: formattedYears });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
};

/**
 * @desc Get Currently Active Year
 */
exports.getActiveYear = async (req, res) => {
    try {
      const activeYear = await FestivalYear.findOne({ club: req.user.clubId, isActive: true });
      if (!activeYear) return res.status(404).json({ message: "No active year found." });
      res.json({ success: true, data: formatYear(activeYear) });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
};

/**
 * @desc Update Year Settings
 */
exports.updateYear = async (req, res) => {
  try {
    const { id } = req.params;
    const { clubId } = req.user;
    const { 
      name, startDate, endDate, 
      subscriptionFrequency, totalInstallments, amountPerInstallment 
    } = req.body;

    const yearDoc = await FestivalYear.findOne({ _id: id, club: clubId });
    if (!yearDoc) throw new Error("Year not found");

    const currentFreq = yearDoc.subscriptionFrequency;
    const currentTotal = yearDoc.totalInstallments;
    
    // Parse current amount safely
    const currentAmountRaw = yearDoc.get('amountPerInstallment', null, { getters: false });
    const currentAmount = currentAmountRaw / 100; 

    const newFreq = subscriptionFrequency || currentFreq;
    const newTotal = Number(totalInstallments) || currentTotal;
    
    let newAmount = currentAmount;
    if (amountPerInstallment !== undefined && amountPerInstallment !== "") {
        newAmount = Number(amountPerInstallment);
    }

    const freqChanged = newFreq !== currentFreq;
    const durationChanged = newTotal !== currentTotal;
    const amountChanged = Math.abs(newAmount - currentAmount) > 0.001;

    // Validation
    const subsWithPayments = await Subscription.countDocuments({
        year: id,
        "installments.isPaid": true
    });

    const hasPayments = subsWithPayments > 0;

    if (freqChanged && hasPayments) {
        throw new Error(`Cannot change Frequency (to ${newFreq}) because payments have already been collected.`);
    }

    if (durationChanged && newTotal < currentTotal) {
        const conflict = await Subscription.findOne({
            year: id,
            installments: {
                $elemMatch: {
                    number: { $gt: newTotal }, 
                    isPaid: true
                }
            }
        });

        if (conflict) {
            const badInst = conflict.installments.find(i => i.isPaid && i.number > newTotal);
            throw new Error(`Cannot reduce to ${newTotal} weeks. Installment #${badInst?.number} is already paid.`);
        }
    }

    // Update Doc
    if (name) yearDoc.name = name;
    if (startDate) yearDoc.startDate = startDate;
    if (endDate) yearDoc.endDate = endDate;
    yearDoc.subscriptionFrequency = newFreq;
    yearDoc.totalInstallments = newTotal;
    yearDoc.amountPerInstallment = newAmount; 

    // Update Subs
    if (freqChanged || durationChanged || amountChanged) {
        await adjustSubscriptions({
            yearId: id,
            newFreq,
            newTotal,
            newAmount
        });
    }

    await yearDoc.save();

    await logAction({
      req,
      action: "YEAR_UPDATED",
      target: `Settings: ${yearDoc.name}`,
      details: { amount: newAmount, frequency: newFreq, totalWeeks: newTotal }
    });

    res.json({ 
        success: true, 
        data: formatYear(yearDoc),
        message: "Settings updated successfully." 
    });

  } catch (err) {
    console.error("Update Year Error:", err);
    res.status(400).json({ message: err.message });
  }
};

/**
 * @desc Close Year Permanently
 */
exports.closeYear = async (req, res) => {
  try {
    const { id } = req.params;
    const { clubId } = req.user;

    const year = await FestivalYear.findOne({ _id: id, club: clubId });
    if (!year) return res.status(404).json({ message: "Year not found" });

    const finalBalance = await calculateBalance(year._id, year.openingBalance);

    year.isActive = false;
    year.isClosed = true;
    year.closingBalance = Number(finalBalance); 
    
    await year.save();

    await logAction({
      req,
      action: "YEAR_CLOSED",
      target: `Closed Cycle: ${year.name}`,
      details: { finalBalance: finalBalance }
    });

    res.json({ 
      success: true, 
      message: `Year '${year.name}' closed. Final Balance: ${finalBalance} saved.`,
      data: formatYear(year)
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

/**
 * 🛠 HELPER: Adjusts Subscriptions
 */
async function adjustSubscriptions({ yearId, newFreq, newTotal, newAmount }) {
    const subs = await Subscription.find({ year: yearId });
    if (subs.length === 0) return;

    for (const sub of subs) {
        let installments = sub.installments;

        if (newFreq === 'none') {
            installments = [];
        } 
        else if (installments.length === 0 && newFreq !== 'none') {
            installments = generateInstallments(newTotal, newAmount);
        }
        else {
            if (newTotal > installments.length) {
                const startNum = installments.length + 1;
                const addedCount = newTotal - installments.length;
                const newItems = generateInstallments(addedCount, newAmount, startNum);
                installments = [...installments, ...newItems];
            }
            else if (newTotal < installments.length) {
                installments = installments.slice(0, newTotal);
            }

            installments.forEach(inst => {
                inst.amountExpected = newAmount;
            });
        }

        const paidCount = installments.filter(i => i.isPaid).length;
        const dueCount = installments.length - paidCount;

        sub.installments = installments;
        sub.totalPaid = paidCount * newAmount; 
        sub.totalDue = dueCount * newAmount;
        
        await sub.save();
    }
}

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