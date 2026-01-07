// src/middleware/validate.js
const validate = (schema) => (req, res, next) => {
  if (!schema) return next();

  // 'stripUnknown: true' removes fields not in the schema (Security)
  const { error, value } = schema.validate(req.body, { 
    abortEarly: false, 
    stripUnknown: true 
  });

  if (error) {
    const errorMessage = error.details.map((detail) => detail.message).join(", ");
    return res.status(400).json({ message: errorMessage });
  }

  // Replace req.body with the sanitized value
  req.body = value;
  next();
};

module.exports = validate;