const { z } = require('zod');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  GATEWAY_PORT: z.coerce.number().int().min(1).max(65535),
  AUTH_SERVICE_URL: z.string().url(),
  TRANSACTION_SERVICE_URL: z.string().url(),
  NOTIFICATION_SERVICE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().url(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  throw new Error(`Invalid gateway environment: ${result.error.message}`);
}

module.exports = { env: result.data };
