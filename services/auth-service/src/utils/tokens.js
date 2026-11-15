const jwt = require('jsonwebtoken');
const { env } = require('../config');

function createTokenPair(userId) {
  const subject = userId.toString();
  const commonOptions = {
    subject,
    issuer: 'fintrack-auth-service',
    audience: 'fintrack-api',
  };

  // Separate keys and token types prevent access tokens from refreshing sessions.
  return {
    accessToken: jwt.sign(
      { tokenType: 'access' },
      env.JWT_ACCESS_SECRET,
      { ...commonOptions, expiresIn: env.ACCESS_TOKEN_TTL },
    ),
    refreshToken: jwt.sign(
      { tokenType: 'refresh' },
      env.JWT_REFRESH_SECRET,
      { ...commonOptions, expiresIn: env.REFRESH_TOKEN_TTL },
    ),
  };
}

module.exports = { createTokenPair };
