const mongoose = require("mongoose");
const { get: getPrice, set: setPrice } = require("../utils/mongooseMoney");

const subscriptionSchema = new mongoose.Schema({
  club: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  year: { type: mongoose.Schema.Types.ObjectId, ref: "FestivalYear", required: true },
  member: { type: mongoose.Schema.Types.ObjectId, ref: "Membership", required: true },
  
  installments: [{
    number: Number,
    // 👈 UPDATED
    amountExpected: { type: Number, get: getPrice, set: setPrice },
    isPaid: { type: Boolean, default: false },
    paidDate: Date,
    collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  }],

  // 👈 UPDATED
  totalPaid: { type: Number, get: getPrice, set: setPrice, default: 0 },
  totalDue: { type: Number, get: getPrice, set: setPrice, default: 0 }
}, { 
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true }
});

subscriptionSchema.index({ year: 1, member: 1 }, { unique: true });

module.exports = mongoose.model("Subscription", subscriptionSchema);