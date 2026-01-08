const IdempotencyKey = require("../models/IdempotencyKey");

module.exports = async (req, res, next) => {
  const key = req.headers["idempotency-key"];
  
  // If no key provided, skip (or enforce strictly if desired)
  if (!key) return next();

  try {
    // 1. Check if key exists
    const existing = await IdempotencyKey.findOne({ key, user: req.user.id });

    if (existing) {
        // A. If we have a saved response, return it immediately (Cache Hit)
        if (existing.responseData) {
             return res.status(existing.responseStatus).json(existing.responseData);
        }
        
        // B. If key exists but no response, it's "Processing" -> Conflict
        return res.status(409).json({ message: "Request is currently being processed. Please wait." });
    }

    // 2. Lock the key (Status: Processing)
    await IdempotencyKey.create({
        key,
        user: req.user.id,
        path: req.originalUrl
    });

    // 3. Intercept the Response
    const originalJson = res.json;
    
    res.json = function (body) {
        // Only cache Client Errors (4xx) and Success (2xx)
        // If Server Error (5xx), delete key to allow retry (Transaction likely rolled back)
        if (res.statusCode >= 500) {
             IdempotencyKey.deleteOne({ key }).exec();
        } else {
             IdempotencyKey.updateOne(
                 { key }, 
                 { responseStatus: res.statusCode, responseData: body }
             ).exec();
        }
        
        // Continue sending response to client
        return originalJson.call(this, body);
    };

    next();
  } catch (err) {
    // Handle race condition (Duplicate Key)
    if (err.code === 11000) {
        return res.status(409).json({ message: "Request overlap detected." });
    }
    console.error("Idempotency Error:", err);
    next(); // Fail open or handle error
  }
};