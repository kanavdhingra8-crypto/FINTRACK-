require('dotenv').config();

const { env } = require('./config');
const { app } = require('./app');
const { connectToDatabase, disconnectFromDatabase } = require('./db');
const { logger } = require('./logger');

async function startServer() {
  await connectToDatabase();
  const server = app.listen(env.TRANSACTION_PORT, () => {
    logger.info({ port: env.TRANSACTION_PORT }, 'Transaction service started');
  });

  const shutdown = async (signal) => {
    logger.info({ signal }, 'Transaction service shutting down');
    server.close(async (error) => {
      if (error) {
        logger.error({ err: error }, 'HTTP server failed to close');
        process.exitCode = 1;
      }

      await disconnectFromDatabase();
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startServer().catch((error) => {
  logger.fatal({ err: error }, 'Transaction service failed to start');
  process.exitCode = 1;
});
