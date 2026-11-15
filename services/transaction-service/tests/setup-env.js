process.env.NODE_ENV = 'test';
process.env.TRANSACTION_PORT = '4002';
process.env.TRANSACTION_MONGODB_URI = 'mongodb://127.0.0.1:27017/fintrack_transactions_test';
process.env.RABBITMQ_URL = 'amqp://127.0.0.1:1';
process.env.RABBITMQ_EXPENSE_QUEUE = 'fintrack.expense.created.test';
process.env.RABBITMQ_CONNECT_TIMEOUT_MS = '500';
process.env.RABBITMQ_PUBLISH_TIMEOUT_MS = '500';
process.env.LOG_LEVEL = 'silent';
