const express = require('express');
const transactionRoutes = require('./routes/transactions');
const { errorHandler, notFound } = require('./middleware/error-handler');
const { requestContext } = require('./middleware/request-context');
const { requireUser } = require('./middleware/require-user');

const app = express();

app.disable('x-powered-by');
app.use(requestContext);
app.use(express.json({ limit: '10kb' }));

app.get('/health', (_req, res) => {
  res.json({ service: 'transaction-service', status: 'ok' });
});
app.use('/transactions', requireUser, transactionRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = { app };
