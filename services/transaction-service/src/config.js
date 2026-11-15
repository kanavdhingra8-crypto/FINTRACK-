const { z } = require('zod');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  TRANSACTION_PORT: z.coerce.number().int().min(1).max(65535),
  TRANSACTION_MONGODB_URI: z.string().url(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  throw new Error(`Invalid transaction-service environment: ${result.error.message}`);
}

module.exports = { env: result.data };
