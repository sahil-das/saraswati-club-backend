const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema({
  club: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  year: { type: mongoose.Schema.Types.ObjectId, ref: "FestivalYear", required: true },
  
  // ✅ MUST BE 'member', NOT 'user'
  member: { type: mongoose.Schema.Types.ObjectId, ref: "Membership", required: true },
  
  installments: [{
    number: Number,
    amountExpected: Number,
    isPaid: { type: Boolean, default: false },
    paidDate: Date,
    collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  }],

  totalPaid: { type: Number, default: 0 },
  totalDue: { type: Number, default: 0 }
}, { timestamps: true });

// ✅ CHECK THIS LINE CAREFULLY:
// It must say 'member: 1', NOT 'user: 1'
subscriptionSchema.index({ year: 1, member: 1 }, { unique: true });

module.exports = mongoose.model("Subscription", subscriptionSchema);