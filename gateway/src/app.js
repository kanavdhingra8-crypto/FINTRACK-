const cors = require('cors');
const express = require('express');
const { env } = require('./config');
const { authenticate } = require('./middleware/authenticate');
const { errorHandler, notFound } = require('./middleware/error-handler');
const { rateLimiter } = require('./middleware/rate-limit');
const { requestContext } = require('./middleware/request-context');
const { authProxy, transactionProxy, notificationProxy } = require('./proxies');

const app = express();

app.disable('x-powered-by');
app.use(requestContext);
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-ID'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

app.get('/health', (_req, res) => {
  res.json({ service: 'gateway', status: 'ok' });
});

app.use(rateLimiter);
app.use(authenticate);
app.use(authProxy);
app.use(transactionProxy);
app.use(notificationProxy);
app.use(notFound);
app.use(errorHandler);

module.exports = { app };
