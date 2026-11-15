const jwt = require('jsonwebtoken');
const { env } = require('../config');
const { ApiError } = require('../errors');

const publicAuthEndpoints = new Set([
  'POST /api/auth/register',
  'POST /api/auth/login',
  'POST /api/auth/refresh',
]);

function authenticate(req, _res, next) {
  // Never forward a user ID supplied directly by the caller.
  delete req.headers['x-user-id'];
  req.userId = undefined;

  const path = req.originalUrl.split('?')[0];
  if (publicAuthEndpoints.has(`${req.method} ${path}`)) {
    return next();
  }

  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'A valid access token is required'));
  }

  try {
    const claims = jwt.verify(match[1], env.JWT_ACCESS_SECRET, {
      issuer: 'fintrack-auth-service',
      audience: 'fintrack-api',
    });

    if (
      typeof claims !== 'object'
      || claims.tokenType !== 'access'
      || typeof claims.sub !== 'string'
      || !/^[a-f\d]{24}$/i.test(claims.sub)
    ) {
      throw new Error('Invalid access token claims');
    }

    req.userId = claims.sub;
    return next();
  } catch (_error) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'A valid access token is required'));
  }
}

module.exports = { authenticate };
