const Joi = require("joi");

const validate = (schema) => {
  return (req, res, next) => {
    // Validate req.body against the schema
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      // Map all errors into a clean array
      const errors = error.details.map((detail) => detail.message.replace(/"/g, ''));
      return res.status(400).json({ 
        message: "Validation Error", 
        errors: errors 
      });
    }

    next();
  };
};

module.exports = validate;