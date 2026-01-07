const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json() // Machine readable JSON logs
  ),
  transports: [
    new winston.transports.Console({
        format: process.env.NODE_ENV === 'production' 
          ? winston.format.json() 
          : winston.format.simple() // Readable for local dev
    })
  ]
});

module.exports = logger;