const amqp = require('amqplib');
const { env } = require('./config');
const { logger } = require('./logger');

async function closeQuietly(resource, label, requestLogger) {
  if (!resource) return;

  try {
    await resource.close();
  } catch (error) {
    requestLogger.warn({ err: error, resource: label }, 'Failed to close RabbitMQ resource');
  }
}

async function waitForConfirmation(channel) {
  let timeout;
  const timedOut = new Promise((_resolve, reject) => {
    timeout = setTimeout(
      () => reject(new Error('RabbitMQ publish confirmation timed out')),
      env.RABBITMQ_PUBLISH_TIMEOUT_MS,
    );
  });

  try {
    await Promise.race([channel.waitForConfirms(), timedOut]);
  } finally {
    clearTimeout(timeout);
  }
}

async function publishExpenseCreated(event, requestLogger = logger) {
  let connection;
  let channel;

  try {
    connection = await amqp.connect(env.RABBITMQ_URL, {
      timeout: env.RABBITMQ_CONNECT_TIMEOUT_MS,
    });
    connection.on('error', (error) => {
      requestLogger.error({ err: error }, 'RabbitMQ connection error');
    });
    channel = await connection.createConfirmChannel();
    channel.on('error', (error) => {
      requestLogger.error({ err: error }, 'RabbitMQ channel error');
    });

    // RabbitMQ decouples transaction writes from notifications; a sleeping worker can catch up later.
    // A durable queue and persistent message let the broker retain events while that worker is offline.
    await channel.assertQueue(env.RABBITMQ_EXPENSE_QUEUE, { durable: true });
    channel.sendToQueue(
      env.RABBITMQ_EXPENSE_QUEUE,
      Buffer.from(JSON.stringify(event)),
      { persistent: true, contentType: 'application/json' },
    );
    await waitForConfirmation(channel);
  } catch (error) {
    // Expense creation must succeed even when RabbitMQ is temporarily unavailable.
    requestLogger.error({
      err: error,
      transactionId: event.transactionId,
    }, 'Failed to publish expense event');
  } finally {
    await closeQuietly(channel, 'channel', requestLogger);
    await closeQuietly(connection, 'connection', requestLogger);
  }
}

module.exports = { publishExpenseCreated };
