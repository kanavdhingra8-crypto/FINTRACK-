const { rateLimit } = require('express-rate-limit');
const { env } = require('../config');

const rateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler(req, res) {
    req.log.warn({ statusCode: 429 }, 'Rate limit exceeded');
    return res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests; please try again later',
      },
      requestId: req.id,
    });
  },
});

module.exports = { rateLimiter };
