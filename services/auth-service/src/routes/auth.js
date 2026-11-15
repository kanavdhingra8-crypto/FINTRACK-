const bcrypt = require('bcryptjs');
const express = require('express');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { env } = require('../config');
const { ApiError } = require('../errors');
const User = require('../models/user');
const { authenticate } = require('../middleware/authenticate');
const { validateBody } = require('../middleware/validate-body');
const { createTokenPair } = require('../utils/tokens');

const router = express.Router();
const registerSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(8).max(128),
}).strict();
const loginSchema = registerSchema;
const refreshSchema = z.object({
  refreshToken: z.string().min(1).max(4096),
}).strict();

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function publicUser(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    createdAt: user.createdAt,
  };
}

function respondWithTokens(res, user, status = 200) {
  return res.status(status).json({
    user: publicUser(user),
    ...createTokenPair(user._id),
  });
}

router.post('/register', validateBody(registerSchema), asyncHandler(async (req, res) => {
  const passwordHash = await bcrypt.hash(req.body.password, env.BCRYPT_ROUNDS);

  try {
    const user = await User.create({ email: req.body.email, passwordHash });
    return respondWithTokens(res, user, 201);
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with this email already exists');
    }
    throw error;
  }
}));

router.post('/login', validateBody(loginSchema), asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
  const passwordMatches = user && await bcrypt.compare(req.body.password, user.passwordHash);

  if (!passwordMatches) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }

  return respondWithTokens(res, user);
}));

router.post('/refresh', validateBody(refreshSchema), asyncHandler(async (req, res) => {
  let claims;
  try {
    claims = jwt.verify(req.body.refreshToken, env.JWT_REFRESH_SECRET, {
      issuer: 'fintrack-auth-service',
      audience: 'fintrack-api',
    });
  } catch (_error) {
    throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'A valid refresh token is required');
  }

  if (typeof claims !== 'object' || claims.tokenType !== 'refresh' || !claims.sub) {
    throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'A valid refresh token is required');
  }

  const user = await User.findById(claims.sub);
  if (!user) {
    throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'A valid refresh token is required');
  }

  return respondWithTokens(res, user);
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findById(req.auth.userId).select('email createdAt');
  if (!user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'A valid access token is required');
  }

  return res.json({ user: publicUser(user) });
}));

module.exports = router;
