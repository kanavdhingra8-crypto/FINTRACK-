const { ApiError } = require('../errors');

function notFound(req, _res, next) {
  next(new ApiError(404, 'NOT_FOUND', 'The requested endpoint does not exist'));
}

function errorHandler(error, req, res, _next) {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';

  if (error instanceof ApiError) {
    status = error.status;
    code = error.code;
    message = error.message;
  }

  if (status >= 500) {
    req.log.error({ err: error }, 'Request failed');
  } else {
    req.log.warn({ code, statusCode: status }, 'Request rejected');
  }

  return res.status(status).json({
    error: { code, message },
    requestId: req.id,
  });
}

module.exports = { errorHandler, notFound };
