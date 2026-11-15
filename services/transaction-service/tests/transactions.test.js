const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('../src/app');
const Transaction = require('../src/models/transaction');

let mongoServer;
const userId = new mongoose.Types.ObjectId().toString();
const anotherUserId = new mongoose.Types.ObjectId().toString();

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await Transaction.init();
});

afterEach(async () => {
  await Transaction.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

function transaction(overrides = {}) {
  return {
    amount: 25.5,
    type: 'expense',
    category: 'Food',
    date: '2026-03-15',
    note: 'Lunch',
    ...overrides,
  };
}

function asUser(id = userId) {
  return { 'x-user-id': id };
}

describe('transaction endpoints', () => {
  test('creates a transaction for the gateway-provided user', async () => {
    const response = await request(app)
      .post('/transactions')
      .set(asUser())
      .send(transaction());

    expect(response.status).toBe(201);
    expect(response.body.transaction).toMatchObject({
      userId,
      amount: 25.5,
      type: 'expense',
      category: 'Food',
      date: '2026-03-15',
      note: 'Lunch',
    });
    expect(response.body.transaction.id).toEqual(expect.any(String));
  });

  test('lists only the user transactions matching filters and pagination', async () => {
    await Transaction.create([
      { userId, amount: '25.50', type: 'expense', category: 'Food', date: new Date('2026-03-15') },
      { userId, amount: '10.00', type: 'expense', category: 'Food', date: new Date('2026-03-10') },
      { userId, amount: '100.00', type: 'income', category: 'Salary', date: new Date('2026-03-01') },
      { userId, amount: '99.00', type: 'expense', category: 'Food', date: new Date('2026-02-20') },
      { userId: anotherUserId, amount: '75.00', type: 'expense', category: 'Food', date: new Date('2026-03-20') },
    ]);

    const response = await request(app)
      .get('/transactions?month=2026-03&type=expense&category=Food&page=1&limit=1')
      .set(asUser());

    expect(response.status).toBe(200);
    expect(response.body.transactions).toHaveLength(1);
    expect(response.body.transactions[0].amount).toBe(25.5);
    expect(response.body.pagination).toEqual({
      page: 1,
      limit: 1,
      total: 2,
      totalPages: 2,
    });
  });

  test('updates only a transaction owned by the current user', async () => {
    const [owned, other] = await Transaction.create([
      { userId, amount: '25.50', type: 'expense', category: 'Food', date: new Date('2026-03-15') },
      { userId: anotherUserId, amount: '50.00', type: 'expense', category: 'Food', date: new Date('2026-03-15') },
    ]);

    const updated = await request(app)
      .put(`/transactions/${owned._id}`)
      .set(asUser())
      .send({ amount: 30, category: 'Groceries' });
    const forbiddenUpdate = await request(app)
      .put(`/transactions/${other._id}`)
      .set(asUser())
      .send({ amount: 60 });

    expect(updated.status).toBe(200);
    expect(updated.body.transaction).toMatchObject({ amount: 30, category: 'Groceries' });
    expect(forbiddenUpdate.status).toBe(404);
    expect(forbiddenUpdate.body.error.code).toBe('TRANSACTION_NOT_FOUND');
  });

  test('deletes only a transaction owned by the current user', async () => {
    const [owned, other] = await Transaction.create([
      { userId, amount: '25.50', type: 'expense', category: 'Food', date: new Date('2026-03-15') },
      { userId: anotherUserId, amount: '50.00', type: 'expense', category: 'Food', date: new Date('2026-03-15') },
    ]);

    const deleted = await request(app)
      .delete(`/transactions/${owned._id}`)
      .set(asUser());
    const otherDelete = await request(app)
      .delete(`/transactions/${other._id}`)
      .set(asUser());

    expect(deleted.status).toBe(204);
    expect(otherDelete.status).toBe(404);
    expect(await Transaction.countDocuments({ userId: anotherUserId })).toBe(1);
  });

  test('summarizes monthly income, expenses, balance, and category totals for one user', async () => {
    await Transaction.create([
      { userId, amount: '2000.00', type: 'income', category: 'Salary', date: new Date('2026-03-01') },
      { userId, amount: '35.25', type: 'expense', category: 'Food', date: new Date('2026-03-12') },
      { userId, amount: '20.00', type: 'expense', category: 'Food', date: new Date('2026-03-20') },
      { userId, amount: '100.00', type: 'expense', category: 'Travel', date: new Date('2026-02-20') },
      { userId: anotherUserId, amount: '5000.00', type: 'income', category: 'Salary', date: new Date('2026-03-01') },
    ]);

    const response = await request(app)
      .get('/transactions/summary?month=2026-03')
      .set(asUser());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      month: '2026-03',
      totalIncome: 2000,
      totalExpense: 55.25,
      balance: 1944.75,
      categories: [
        { category: 'Food', income: 0, expense: 55.25 },
        { category: 'Salary', income: 2000, expense: 0 },
      ],
    });
  });

  test('requires a valid gateway user ID and validates write input', async () => {
    const missingIdentity = await request(app)
      .get('/transactions');
    const invalidIdentity = await request(app)
      .get('/transactions')
      .set('x-user-id', 'not-an-object-id');
    const invalidBody = await request(app)
      .post('/transactions')
      .set(asUser())
      .send(transaction({ amount: -1 }));

    expect(missingIdentity.status).toBe(401);
    expect(missingIdentity.body.error.code).toBe('UNAUTHORIZED');
    expect(invalidIdentity.status).toBe(401);
    expect(invalidBody.status).toBe(400);
    expect(invalidBody.body.error.code).toBe('VALIDATION_ERROR');
    expect(invalidBody.body.requestId).toEqual(expect.any(String));
  });
});

test('health endpoint reports the service status', async () => {
  const response = await request(app).get('/health');

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ service: 'transaction-service', status: 'ok' });
});
