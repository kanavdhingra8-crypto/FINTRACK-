const express = require('express');
const { z } = require('zod');
const {
  createTransaction,
  deleteTransaction,
  listTransactions,
  summarizeTransactions,
  updateTransaction,
} = require('../transactions');
const { validateRequest } = require('../middleware/validate-request');

const router = express.Router();
const dateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Date must be a real calendar date');
const amountSchema = z.number()
  .finite()
  .positive()
  .max(1_000_000_000_000)
  .refine((amount) => Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-8, {
    message: 'Amount can have at most two decimal places',
  });
const transactionFields = z.object({
  amount: amountSchema,
  type: z.enum(['income', 'expense']),
  category: z.string().trim().min(1).max(50),
  date: dateSchema,
  note: z.string().trim().max(500).optional(),
}).strict();
const updateSchema = transactionFields.partial()
  .refine((input) => Object.keys(input).length > 0, 'At least one field is required');
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must use YYYY-MM format');
const idParamsSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Transaction ID is invalid'),
}).strict();
const listQuerySchema = z.object({
  month: monthSchema.optional(),
  type: z.enum(['income', 'expense']).optional(),
  category: z.string().trim().min(1).max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
}).strict();
const summaryQuerySchema = z.object({
  month: monthSchema,
}).strict();

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

router.get('/summary', validateRequest({ query: summaryQuerySchema }), asyncHandler(async (req, res) => {
  const summary = await summarizeTransactions(req.userId, req.validated.query.month);
  return res.json(summary);
}));

router.get('/', validateRequest({ query: listQuerySchema }), asyncHandler(async (req, res) => {
  const result = await listTransactions(req.userId, req.validated.query);
  return res.json(result);
}));

router.post('/', validateRequest({ body: transactionFields }), asyncHandler(async (req, res) => {
  const transaction = await createTransaction(req.userId, req.validated.body, req.log);
  return res.status(201).json({ transaction });
}));

router.put('/:id', validateRequest({
  params: idParamsSchema,
  body: updateSchema,
}), asyncHandler(async (req, res) => {
  const transaction = await updateTransaction(
    req.userId,
    req.validated.params.id,
    req.validated.body,
  );
  return res.json({ transaction });
}));

router.delete('/:id', validateRequest({ params: idParamsSchema }), asyncHandler(async (req, res) => {
  await deleteTransaction(req.userId, req.validated.params.id);
  return res.status(204).end();
}));

module.exports = router;
