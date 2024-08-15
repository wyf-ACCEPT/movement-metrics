const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level}]: ${message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: 'logs/imola-parsing.log', format: winston.format.simple()
    })
  ],
});

logger.info('This is an info log');
logger.warn('This is a warning log');
logger.error('This is an error log');
