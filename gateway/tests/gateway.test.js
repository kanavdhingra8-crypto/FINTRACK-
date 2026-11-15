const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { env } = require('../src/config');

let app;
let upstreamServer;
const upstreamApp = express();
upstreamApp.use(express.json());
upstreamApp.use((req, res) => {
  res.json({
    path: req.path,
    userId: req.get('x-user-id') || null,
    requestId: req.get('x-request-id'),
    body: req.body,
  });
});

beforeAll(async () => {
  upstreamServer = await new Promise((resolve) => {
    const server = upstreamApp.listen(0, () => resolve(server));
  });
  const upstreamUrl = `http://127.0.0.1:${upstreamServer.address().port}`;
  process.env.AUTH_SERVICE_URL = upstreamUrl;
  process.env.TRANSACTION_SERVICE_URL = upstreamUrl;
  process.env.NOTIFICATION_SERVICE_URL = upstreamUrl;

  jest.resetModules();
  ({ app } = require('../src/app'));
});

afterAll(async () => {
  await new Promise((resolve, reject) => {
    upstreamServer.close((error) => (error ? reject(error) : resolve()));
  });
});

test('health endpoint reports the gateway status and request ID', async () => {
  const response = await request(app).get('/health');

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ service: 'gateway', status: 'ok' });
  expect(response.headers['x-request-id']).toEqual(expect.any(String));
});

test('rejects a protected API request when the access token is missing', async () => {
  const response = await request(app)
    .get('/api/transactions')
    .set('x-user-id', '0123456789abcdef01234567');

  expect(response.status).toBe(401);
  expect(response.body.error).toEqual({
    code: 'UNAUTHORIZED',
    message: 'A valid access token is required',
  });
  expect(response.body.requestId).toEqual(expect.any(String));
});

test('proxies only the verified user ID and a gateway-generated request ID', async () => {
  const verifiedUserId = '1234567890abcdef12345678';
  const token = jwt.sign(
    { tokenType: 'access' },
    env.JWT_ACCESS_SECRET,
    {
      subject: verifiedUserId,
      issuer: 'fintrack-auth-service',
      audience: 'fintrack-api',
      expiresIn: '5m',
    },
  );
  const response = await request(app)
    .post('/api/transactions')
    .set('Authorization', `Bearer ${token}`)
    .set('x-user-id', 'aaaaaaaaaaaaaaaaaaaaaaaa')
    .set('x-request-id', 'client-controlled-id')
    .send({ amount: 25 });

  expect(response.status).toBe(200);
  expect(response.body.path).toBe('/transactions');
  expect(response.body.userId).toBe(verifiedUserId);
  expect(response.body.requestId).toBe(response.headers['x-request-id']);
  expect(response.body.requestId).not.toBe('client-controlled-id');
  expect(response.body.body).toEqual({ amount: 25 });
});

test('allows public registration without forwarding a client user ID', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .set('x-user-id', 'aaaaaaaaaaaaaaaaaaaaaaaa')
    .send({ email: 'person@example.com' });

  expect(response.status).toBe(200);
  expect(response.body.path).toBe('/register');
  expect(response.body.userId).toBeNull();
});
