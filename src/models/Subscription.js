const mongoose = require("mongoose");
const mongooseMoney = require("../utils/mongooseMoney");

const subscriptionSchema = new mongoose.Schema({
  club: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  year: { type: mongoose.Schema.Types.ObjectId, ref: "FestivalYear", required: true },
  member: { type: mongoose.Schema.Types.ObjectId, ref: "Membership", required: true },
  
  installments: [{
    number: Number,
    // ✅ ADD Min Constraint
    amountExpected: { ...mongooseMoney, min: 0 }, 
    isPaid: { type: Boolean, default: false },
    paidDate: Date,
    collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  }],

  // ✅ ADD Min Constraint
  totalPaid: { ...mongooseMoney, default: 0, min: 0 },
  totalDue: { ...mongooseMoney, default: 0, min: 0 }
}, { timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true }
});

subscriptionSchema.index({ year: 1, member: 1 }, { unique: true });

module.exports = mongoose.model("Subscription", subscriptionSchema);