const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('../src/app');
const Notification = require('../src/models/notification');
const UserSettings = require('../src/models/user-settings');
const { processExpenseEvent } = require('../src/notifications');

let mongoServer;
const userId = new mongoose.Types.ObjectId().toString();
const anotherUserId = new mongoose.Types.ObjectId().toString();

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await Promise.all([Notification.init(), UserSettings.init()]);
});

afterEach(async () => {
  await Promise.all([Notification.deleteMany({}), UserSettings.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

function asUser(id = userId) {
  return { 'x-user-id': id };
}

function expenseEvent(overrides = {}) {
  return {
    userId,
    transactionId: new mongoose.Types.ObjectId().toString(),
    amount: 12500,
    category: 'Travel',
    date: '2026-03-15',
    ...overrides,
  };
}

test('health endpoint reports the service status', async () => {
  const response = await request(app).get('/health');

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ service: 'notification-service', status: 'ok' });
});

test('stores a notification only when an expense exceeds the default threshold', async () => {
  const aboveThreshold = expenseEvent();
  const belowThreshold = expenseEvent({ amount: 10000 });

  await expect(processExpenseEvent(aboveThreshold)).resolves.toBe(true);
  await expect(processExpenseEvent(belowThreshold)).resolves.toBe(false);

  const response = await request(app)
    .get('/notifications')
    .set(asUser());

  expect(response.status).toBe(200);
  expect(response.body.unreadCount).toBe(1);
  expect(response.body.notifications).toHaveLength(1);
  expect(response.body.notifications[0]).toMatchObject({
    userId,
    transactionId: aboveThreshold.transactionId,
    amount: 12500,
    category: 'Travel',
    isRead: false,
  });
});

test('uses the user threshold and marks only that user notification as read', async () => {
  await request(app)
    .put('/settings/threshold')
    .set(asUser())
    .send({ threshold: 20000 });
  await expect(processExpenseEvent(expenseEvent({ amount: 15000 }))).resolves.toBe(false);
  await expect(processExpenseEvent(expenseEvent({ amount: 25000 }))).resolves.toBe(true);

  const notification = await Notification.findOne({ userId });
  const response = await request(app)
    .patch(`/notifications/${notification._id}/read`)
    .set(asUser());
  const otherUserResponse = await request(app)
    .patch(`/notifications/${notification._id}/read`)
    .set(asUser(anotherUserId));

  expect(response.status).toBe(200);
  expect(response.body.notification.isRead).toBe(true);
  expect(response.body.notification.readAt).toEqual(expect.any(String));
  expect(otherUserResponse.status).toBe(404);
});

test('rejects invalid threshold input and missing user identity', async () => {
  const invalidThreshold = await request(app)
    .put('/settings/threshold')
    .set(asUser())
    .send({ threshold: -1 });
  const missingIdentity = await request(app)
    .get('/notifications');

  expect(invalidThreshold.status).toBe(400);
  expect(invalidThreshold.body.error.code).toBe('VALIDATION_ERROR');
  expect(missingIdentity.status).toBe(401);
});
