const FestivalYear = require("../models/FestivalYear");
const calculateBalance = require("../utils/calculateBalance"); 

exports.createYear = async (req, res) => {
  try {
    const { 
      name, startDate, endDate, openingBalance, 
      subscriptionFrequency, totalInstallments, amountPerInstallment 
    } = req.body;
    
    const { clubId, id: userId } = req.user;

    // Validate Frequency
    const VALID_FREQUENCIES = ["weekly", "monthly", "none"];
    const frequency = subscriptionFrequency || "weekly";
    if (!VALID_FREQUENCIES.includes(frequency)) return res.status(400).json({ message: "Invalid frequency." });

    // 1. FIND LAST YEAR (Active or Closed)
    const lastYear = await FestivalYear.findOne({ club: clubId }).sort({ createdAt: -1 });

    let derivedBalance = 0;

    if (lastYear) {
       console.log(`📅 Previous Year Found: "${lastYear.name}"`);

       // A. If previous year is ALREADY CLOSED, use its stored Closing Balance
       if (lastYear.isClosed) {
          derivedBalance = lastYear.closingBalance;
          console.log(`✅ Using Stored Closing Balance: ₹${derivedBalance}`);
       } 
       // B. If previous year is STILL ACTIVE, calculate it now & close it
       else {
          derivedBalance = await calculateBalance(lastYear._id, lastYear.openingBalance);
          console.log(`⚠️ Previous year was active. Calculated Balance: ₹${derivedBalance}`);
          
          // Auto-close previous year
          lastYear.isActive = false;
          lastYear.isClosed = true;
          lastYear.closingBalance = derivedBalance; // Save it now
          await lastYear.save();
       }
    }

    // 2. Determine Opening Balance
    // Prefer Derived Balance unless user explicitly overrides with a non-zero number
    let finalOpeningBalance = derivedBalance;
    
    if (openingBalance !== undefined && openingBalance !== "" && openingBalance !== null) {
        const inputVal = Number(openingBalance);
        if (inputVal !== 0 || derivedBalance === 0) {
            finalOpeningBalance = inputVal;
        }
    }

    // 3. Create New Year
    const newYear = await FestivalYear.create({
      club: clubId,
      name,
      startDate,
      endDate,
      openingBalance: finalOpeningBalance,
      subscriptionFrequency: frequency,
      totalInstallments: frequency === 'none' ? 0 : (Number(totalInstallments) || 52),
      amountPerInstallment: frequency === 'none' ? 0 : (Number(amountPerInstallment) || 0),
      isActive: true,
      isClosed: false,
      createdBy: userId
    });

    res.status(201).json({
      success: true,
      message: `Cycle '${name}' started. Opening Balance: ₹${finalOpeningBalance}`,
      year: newYear
    });

  } catch (err) {
    console.error("Create Year Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ... (Keep existing exports: getAllYears, getActiveYear, updateYear, closeYear) ...
exports.getAllYears = async (req, res) => {
    try {
      const years = await FestivalYear.find({ club: req.user.clubId }).sort({ startDate: -1 });
      res.json({ success: true, data: years });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
};

exports.getActiveYear = async (req, res) => {
    try {
      const activeYear = await FestivalYear.findOne({ club: req.user.clubId, isActive: true });
      if (!activeYear) return res.status(404).json({ message: "No active year found." });
      res.json({ success: true, data: activeYear });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
};

exports.updateYear = async (req, res) => {
    try {
      const updated = await FestivalYear.findOneAndUpdate(
        { _id: req.params.id, club: req.user.clubId },
        req.body,
        { new: true }
      );
      res.json({ success: true, data: updated });
    } catch (err) { res.status(500).json({ message: "Server Error" }); }
};
  
exports.closeYear = async (req, res) => {
  try {
    const { id } = req.params;
    const { clubId } = req.user;

    // 1. Find the year
    const year = await FestivalYear.findOne({ _id: id, club: clubId });
    if (!year) return res.status(404).json({ message: "Year not found" });

    // 2. Calculate Final Balance one last time
    const finalBalance = await calculateBalance(year._id, year.openingBalance);

    // 3. Save updates
    year.isActive = false;
    year.isClosed = true;
    year.closingBalance = finalBalance; // ✅ STORED PERMANENTLY
    
    await year.save();

    res.json({ 
      success: true, 
      message: `Year '${year.name}' closed. Final Balance: ₹${finalBalance} saved.`,
      data: year
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};