const express = require('express');
const authRoutes = require('./routes/auth');
const { errorHandler, notFound } = require('./middleware/error-handler');
const { requestContext } = require('./middleware/request-context');

const app = express();

app.disable('x-powered-by');
app.use(requestContext);
app.use(express.json({ limit: '10kb' }));

app.get('/health', (_req, res) => {
  res.json({ service: 'auth-service', status: 'ok' });
});
app.use('/', authRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = { app };
