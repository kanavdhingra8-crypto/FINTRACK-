const { randomUUID } = require('node:crypto');
const { logger } = require('../logger');

function requestContext(req, res, next) {
  // Always mint the ID here; a client-provided ID is not trusted.
  req.id = randomUUID();
  req.log = logger.child({ requestId: req.id });
  res.setHeader('x-request-id', req.id);
  res.on('finish', () => {
    req.log.info({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
    }, 'Request completed');
  });

  next();
}

module.exports = { requestContext };
