const mongoose = require('mongoose');
const { ApiError } = require('../errors');

function requireUser(req, _res, next) {
  const userId = req.get('x-user-id');

  // The gateway sets this header only after it verifies the user's JWT.
  if (!userId || !mongoose.isObjectIdOrHexString(userId)) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'A valid user identity is required'));
  }

  req.userId = new mongoose.Types.ObjectId(userId);
  return next();
}

module.exports = { requireUser };
