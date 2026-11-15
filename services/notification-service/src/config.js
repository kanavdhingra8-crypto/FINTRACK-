const { z } = require('zod');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  NOTIFICATION_PORT: z.coerce.number().int().min(1).max(65535),
  NOTIFICATION_MONGODB_URI: z.string().url(),
  RABBITMQ_URL: z.string().url(),
  RABBITMQ_EXPENSE_QUEUE: z.string().min(1),
  RABBITMQ_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(100).max(30000),
  RABBITMQ_RECONNECT_DELAY_MS: z.coerce.number().int().min(100).max(60000),
  RABBITMQ_RETRY_DELAY_MS: z.coerce.number().int().min(100).max(60000),
  DEFAULT_EXPENSE_THRESHOLD: z.coerce.number().positive().max(1_000_000_000_000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  throw new Error(`Invalid notification-service environment: ${result.error.message}`);
}

module.exports = { env: result.data };
