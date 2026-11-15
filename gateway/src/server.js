require('dotenv').config();

const { env } = require('./config');
const { app } = require('./app');
const { logger } = require('./logger');

const server = app.listen(env.GATEWAY_PORT, () => {
  logger.info({ port: env.GATEWAY_PORT }, 'API gateway started');
});

function shutdown(signal) {
  logger.info({ signal }, 'API gateway shutting down');
  server.close((error) => {
    if (error) {
      logger.error({ err: error }, 'API gateway failed to close');
      process.exitCode = 1;
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
