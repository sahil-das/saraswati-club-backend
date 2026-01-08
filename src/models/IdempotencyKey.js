const mongoose = require("mongoose");

const idempotencyKeySchema = new mongoose.Schema({
  // The unique key sent by the client (e.g., UUID)
  key: { type: String, required: true, unique: true, index: true },
  
  // Link to user/path to prevent key reuse across different actions
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  path: { type: String, required: true },
  
  // Store the result to return it instantly on retry
  responseStatus: { type: Number },
  responseData: { type: Object },
  
  // Auto-delete keys after 24 hours (TTL)
  createdAt: { type: Date, default: Date.now, expires: 86400 } 
});

module.exports = mongoose.model("IdempotencyKey", idempotencyKeySchema);