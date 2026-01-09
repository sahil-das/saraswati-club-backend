require('dotenv').config();
const mongoose = require('mongoose');
const { app, PORT } = require('./src/app');
const logger = require('./src/utils/logger');
const server = app.listen(PORT, () => {
  logger.info(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Replace console.error with logger.error in shutdown logic
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Closing server...`);
  try {
    server.close(() => logger.info('HTTP server closed.'));
    await mongoose.connection.close(false);
    logger.info('MongoDB connection closed.');
    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown:', err);
    process.exit(1);
  }
};

// 3. Listen for Termination Signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 4. Handle Uncaught Errors (Prevent zombie processes)
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});