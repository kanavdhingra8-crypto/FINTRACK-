require('dotenv').config();

const { env } = require('./config');
const { app } = require('./app');
const { startExpenseConsumer } = require('./consumer');
const { connectToDatabase, disconnectFromDatabase } = require('./db');
const { logger } = require('./logger');

async function startServer() {
  await connectToDatabase();
  const stopConsumer = startExpenseConsumer();
  const server = app.listen(env.NOTIFICATION_PORT, () => {
    logger.info({ port: env.NOTIFICATION_PORT }, 'Notification service started');
  });

  const shutdown = async (signal) => {
    logger.info({ signal }, 'Notification service shutting down');
    server.close(async (error) => {
      if (error) {
        logger.error({ err: error }, 'HTTP server failed to close');
        process.exitCode = 1;
      }
      await stopConsumer();
      await disconnectFromDatabase();
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startServer().catch((error) => {
  logger.fatal({ err: error }, 'Notification service failed to start');
  process.exitCode = 1;
});
