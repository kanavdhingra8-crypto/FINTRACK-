const express = require('express');
const notificationRoutes = require('./routes/notifications');
const { errorHandler, notFound } = require('./middleware/error-handler');
const { requestContext } = require('./middleware/request-context');
const { requireUser } = require('./middleware/require-user');
const { validateRequest } = require('./middleware/validate-request');
const { setExpenseThreshold } = require('./notifications');
const { z } = require('zod');

const app = express();
const thresholdSchema = z.object({
  threshold: z.number().finite().positive().max(1_000_000_000_000)
    .refine((amount) => Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-8, {
      message: 'Threshold can have at most two decimal places',
    }),
}).strict();

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

app.disable('x-powered-by');
app.use(requestContext);
app.use(express.json({ limit: '10kb' }));

app.get('/health', (_req, res) => {
  res.json({ service: 'notification-service', status: 'ok' });
});
app.use('/notifications', requireUser, notificationRoutes);
app.put(
  '/settings/threshold',
  requireUser,
  validateRequest({ body: thresholdSchema }),
  asyncHandler(async (req, res) => {
    const threshold = await setExpenseThreshold(req.userId, req.validated.body.threshold);
    return res.json({ threshold });
  }),
);
app.use(notFound);
app.use(errorHandler);

module.exports = { app };
