const amqp = require('amqplib');
const { ZodError } = require('zod');
const { env } = require('./config');
const { logger } = require('./logger');
const { processExpenseEvent } = require('./notifications');

function startExpenseConsumer() {
  let connection;
  let channel;
  let stopped = false;
  let reconnectTimer;

  function scheduleReconnect() {
    if (stopped || reconnectTimer) return;

    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      connect();
    }, env.RABBITMQ_RECONNECT_DELAY_MS);
    reconnectTimer.unref();
  }

  async function closeCurrentConnection() {
    const currentChannel = channel;
    const currentConnection = connection;
    channel = undefined;
    connection = undefined;

    try {
      if (currentChannel) await currentChannel.close();
    } catch (error) {
      logger.warn({ err: error }, 'Failed to close RabbitMQ channel');
    }
    try {
      if (currentConnection) await currentConnection.close();
    } catch (error) {
      logger.warn({ err: error }, 'Failed to close RabbitMQ connection');
    }
  }

  async function connect() {
    if (stopped) return;

    try {
      connection = await amqp.connect(env.RABBITMQ_URL, {
        timeout: env.RABBITMQ_CONNECT_TIMEOUT_MS,
      });
      connection.on('error', (error) => {
        logger.error({ err: error }, 'RabbitMQ connection error');
      });
      connection.on('close', () => {
        if (stopped) return;
        logger.warn('RabbitMQ connection closed; reconnecting');
        channel = undefined;
        connection = undefined;
        scheduleReconnect();
      });

      channel = await connection.createChannel();
      const activeChannel = channel;
      channel.on('error', (error) => {
        logger.error({ err: error }, 'RabbitMQ channel error');
      });
      channel.on('close', () => {
        if (!stopped && connection) {
          connection.close().catch((error) => {
            logger.warn({ err: error }, 'Failed to close RabbitMQ connection after channel close');
          });
        }
      });

      await channel.assertQueue(env.RABBITMQ_EXPENSE_QUEUE, { durable: true });
      await channel.prefetch(1);
      await channel.consume(env.RABBITMQ_EXPENSE_QUEUE, async (message) => {
        if (!message) return;

        try {
          const event = JSON.parse(message.content.toString());
          await processExpenseEvent(event);
          activeChannel.ack(message);
        } catch (error) {
          logger.error({ err: error }, 'Failed to process expense event');
          try {
            if (error instanceof ZodError || error instanceof SyntaxError) {
              activeChannel.ack(message);
            } else {
              const retryTimer = setTimeout(() => {
                try {
                  activeChannel.nack(message, false, true);
                } catch (nackError) {
                  logger.error({ err: nackError }, 'Failed to requeue expense event');
                }
              }, env.RABBITMQ_RETRY_DELAY_MS);
              retryTimer.unref();
            }
          } catch (ackError) {
            logger.error({ err: ackError }, 'Failed to acknowledge expense event');
          }
        }
      });
      logger.info({ queue: env.RABBITMQ_EXPENSE_QUEUE }, 'Expense event consumer started');
    } catch (error) {
      logger.error({ err: error }, 'Could not connect expense event consumer');
      await closeCurrentConnection();
      scheduleReconnect();
    }
  }

  connect();

  return async function stop() {
    stopped = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    await closeCurrentConnection();
  };
}

module.exports = { startExpenseConsumer };
