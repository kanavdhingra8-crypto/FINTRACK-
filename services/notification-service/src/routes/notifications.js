const express = require('express');
const { z } = require('zod');
const {
  listNotifications,
  markNotificationRead,
} = require('../notifications');
const { validateRequest } = require('../middleware/validate-request');

const router = express.Router();
const idParamsSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Notification ID is invalid'),
}).strict();
function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const result = await listNotifications(req.userId);
  return res.json(result);
}));

router.patch('/:id/read', validateRequest({ params: idParamsSchema }), asyncHandler(async (req, res) => {
  const notification = await markNotificationRead(req.userId, req.validated.params.id);
  return res.json({ notification });
}));

module.exports = router;
