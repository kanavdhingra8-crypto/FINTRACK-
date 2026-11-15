const { ZodError } = require('zod');
const { ApiError } = require('../errors');

function notFound(req, _res, next) {
  next(new ApiError(404, 'NOT_FOUND', 'The requested endpoint does not exist'));
}

function errorHandler(error, req, res, _next) {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';

  if (error instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Request validation failed';
  } else if (error instanceof ApiError) {
    status = error.status;
    code = error.code;
    message = error.message;
  } else if (error.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Request body must be valid JSON';
  } else if (error.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body is too large';
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
