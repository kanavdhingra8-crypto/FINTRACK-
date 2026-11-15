const jwt = require('jsonwebtoken');
const { env } = require('../config');
const { ApiError } = require('../errors');

function authenticate(req, _res, next) {
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

    if (typeof claims !== 'object' || claims.tokenType !== 'access' || !claims.sub) {
      throw new Error('Invalid access token claims');
    }

    req.auth = { userId: claims.sub };
    return next();
  } catch (_error) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'A valid access token is required'));
  }
}

module.exports = { authenticate };
