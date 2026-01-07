const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

router.get("/", async (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
  
  if (dbStatus === 1) {
    res.status(200).json({ 
      status: "UP", 
      database: "connected", 
      timestamp: new Date() 
    });
  } else {
    res.status(503).json({ 
      status: "DOWN", 
      database: "disconnected", 
      timestamp: new Date() 
    });
  }
});

module.exports = router;