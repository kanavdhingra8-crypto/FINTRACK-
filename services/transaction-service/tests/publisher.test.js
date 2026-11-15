jest.mock('amqplib', () => ({
  connect: jest.fn(),
}));

const amqp = require('amqplib');
const { env } = require('../src/config');
const { publishExpenseCreated } = require('../src/publisher');

let connection;
let channel;

beforeEach(() => {
  channel = {
    on: jest.fn(),
    assertQueue: jest.fn().mockResolvedValue({}),
    sendToQueue: jest.fn(),
    waitForConfirms: jest.fn().mockResolvedValue(),
    close: jest.fn().mockResolvedValue(),
  };
  connection = {
    on: jest.fn(),
    createConfirmChannel: jest.fn().mockResolvedValue(channel),
    close: jest.fn().mockResolvedValue(),
  };
  amqp.connect.mockReset().mockResolvedValue(connection);
});

test('publishes the expense event to a durable queue and waits for confirmation', async () => {
  const event = {
    userId: '1234567890abcdef12345678',
    transactionId: 'abcdef123456789012345678',
    amount: 12500,
    category: 'Travel',
    date: '2026-03-15',
  };

  await publishExpenseCreated(event);

  expect(channel.assertQueue).toHaveBeenCalledWith(env.RABBITMQ_EXPENSE_QUEUE, { durable: true });
  expect(channel.sendToQueue).toHaveBeenCalledWith(
    env.RABBITMQ_EXPENSE_QUEUE,
    Buffer.from(JSON.stringify(event)),
    expect.objectContaining({ persistent: true, contentType: 'application/json' }),
  );
  expect(channel.waitForConfirms).toHaveBeenCalled();
  expect(channel.close).toHaveBeenCalled();
  expect(connection.close).toHaveBeenCalled();
});

test('does not throw when RabbitMQ is unavailable', async () => {
  amqp.connect.mockRejectedValueOnce(new Error('broker unavailable'));

  await expect(publishExpenseCreated({ transactionId: 'unavailable' })).resolves.toBeUndefined();
});
