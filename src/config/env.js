require('dotenv').config();
const Joi = require('joi');

const envSchema = Joi.object({
  PORT: Joi.number().default(3000),
  MONGO_URI: Joi.string().required().description("MongoDB Connection URL"),
  JWT_SECRET: Joi.string().required().min(12).description("Secret for signing tokens"),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  CORS_ORIGIN: Joi.string().default('http://localhost:5173')
}).unknown(); // Allow other env vars

const { error, value } = envSchema.validate(process.env);

if (error) {
  console.error(`🚨CRITICAL: Config validation error: ${error.message}`);
  process.exit(1); // Stop the app immediately
}

module.exports = {
  PORT: value.PORT,
  MONGO_URI: value.MONGO_URI,
  JWT_SECRET: value.JWT_SECRET,
  NODE_ENV: value.NODE_ENV,
  CORS_ORIGIN: value.CORS_ORIGIN
};