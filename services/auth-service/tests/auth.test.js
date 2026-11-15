const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('../src/app');
const User = require('../src/models/user');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await User.init();
});

afterEach(async () => {
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('auth endpoints', () => {
  const credentials = {
    email: 'person@example.com',
    password: 'a-strong-password',
  };

  test('registers a user and returns an access and refresh token', async () => {
    const response = await request(app)
      .post('/register')
      .send(credentials);

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe(credentials.email);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toEqual(expect.any(String));

    const storedUser = await User.findOne({ email: credentials.email }).select('+passwordHash');
    expect(storedUser.passwordHash).not.toBe(credentials.password);
    await expect(bcrypt.compare(credentials.password, storedUser.passwordHash))
      .resolves.toBe(true);
  });

  test('logs in with the correct password', async () => {
    await request(app).post('/register').send(credentials);

    const response = await request(app)
      .post('/login')
      .send(credentials);

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe(credentials.email);
    expect(response.body.accessToken).toEqual(expect.any(String));
  });

  test('rejects a wrong password with the standard error shape', async () => {
    await request(app).post('/register').send(credentials);

    const response = await request(app)
      .post('/login')
      .send({ ...credentials, password: 'incorrect-password' });

    expect(response.status).toBe(401);
    expect(response.body.error).toEqual({
      code: 'INVALID_CREDENTIALS',
      message: 'Email or password is incorrect',
    });
    expect(response.body.requestId).toEqual(expect.any(String));
  });

  test('returns the authenticated user from /me', async () => {
    const registerResponse = await request(app)
      .post('/register')
      .send(credentials);

    const response = await request(app)
      .get('/me')
      .set('Authorization', `Bearer ${registerResponse.body.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe(credentials.email);
    expect(response.body.user).not.toHaveProperty('passwordHash');
  });

  test('rejects invalid input and an access token used as a refresh token', async () => {
    const invalidInput = await request(app)
      .post('/register')
      .send({ email: 'not-an-email', password: 'short' });

    expect(invalidInput.status).toBe(400);
    expect(invalidInput.body.error.code).toBe('VALIDATION_ERROR');

    const registerResponse = await request(app)
      .post('/register')
      .send(credentials);
    const invalidRefresh = await request(app)
      .post('/refresh')
      .send({ refreshToken: registerResponse.body.accessToken });

    expect(invalidRefresh.status).toBe(401);
    expect(invalidRefresh.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });
});

test('health endpoint reports the service status', async () => {
  const response = await request(app).get('/health');

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ service: 'auth-service', status: 'ok' });
});
