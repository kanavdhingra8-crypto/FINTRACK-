const pino = require('pino');
const { env } = require('./config');

const logger = pino({ level: env.LOG_LEVEL });

module.exports = { logger };
