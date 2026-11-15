const mongoose = require('mongoose');
const { z } = require('zod');
const { env } = require('./config');
const { ApiError } = require('./errors');
const Notification = require('./models/notification');
const UserSettings = require('./models/user-settings');

const amountSchema = z.number()
  .finite()
  .positive()
  .max(1_000_000_000_000)
  .refine((amount) => Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-8);
const expenseEventSchema = z.object({
  userId: z.string().regex(/^[a-f\d]{24}$/i),
  transactionId: z.string().regex(/^[a-f\d]{24}$/i),
  amount: amountSchema,
  category: z.string().min(1).max(50),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }),
}).strict();

function toDecimal(amount) {
  return mongoose.Types.Decimal128.fromString((Math.round(amount * 100) / 100).toFixed(2));
}

function serializeNotification(notification) {
  const row = typeof notification.toObject === 'function'
    ? notification.toObject()
    : notification;

  return {
    id: row._id.toString(),
    userId: row.userId.toString(),
    transactionId: row.transactionId.toString(),
    amount: Number(row.amount.toString()),
    category: row.category,
    date: row.date.toISOString().slice(0, 10),
    isRead: row.isRead,
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

async function getOrCreateSettings(userId) {
  try {
    return await UserSettings.findOneAndUpdate(
      { userId },
      { $setOnInsert: { expenseThreshold: toDecimal(env.DEFAULT_EXPENSE_THRESHOLD) } },
      { new: true, upsert: true },
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    return UserSettings.findOne({ userId });
  }
}

async function processExpenseEvent(input) {
  const event = expenseEventSchema.parse(input);
  const userId = new mongoose.Types.ObjectId(event.userId);
  const transactionId = new mongoose.Types.ObjectId(event.transactionId);
  const settings = await getOrCreateSettings(userId);

  if (event.amount <= Number(settings.expenseThreshold.toString())) {
    return false;
  }

  try {
    await Notification.updateOne(
      { userId, transactionId },
      {
        $setOnInsert: {
          amount: toDecimal(event.amount),
          category: event.category,
          date: new Date(`${event.date}T00:00:00.000Z`),
        },
      },
      { upsert: true },
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
  }

  return true;
}

async function setExpenseThreshold(userId, threshold) {
  const settings = await UserSettings.findOneAndUpdate(
    { userId },
    { $set: { expenseThreshold: toDecimal(threshold) } },
    { new: true, upsert: true },
  );

  return Number(settings.expenseThreshold.toString());
}

async function listNotifications(userId) {
  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ userId }).sort({ createdAt: -1 }).limit(100).lean(),
    Notification.countDocuments({ userId, isRead: false }),
  ]);

  return {
    notifications: notifications.map(serializeNotification),
    unreadCount,
  };
}

async function markNotificationRead(userId, id) {
  const notification = await Notification.findOneAndUpdate(
    { _id: id, userId },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true },
  );

  if (!notification) {
    throw new ApiError(404, 'NOTIFICATION_NOT_FOUND', 'Notification was not found');
  }

  return serializeNotification(notification);
}

module.exports = {
  processExpenseEvent,
  setExpenseThreshold,
  listNotifications,
  markNotificationRead,
};
