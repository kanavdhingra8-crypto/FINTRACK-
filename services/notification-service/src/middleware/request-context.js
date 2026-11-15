const { randomUUID } = require('node:crypto');
const { logger } = require('../logger');

const requestIdPattern = /^[A-Za-z0-9._:-]{1,128}$/;

function requestContext(req, res, next) {
  const incomingId = req.get('x-request-id');
  const requestId = incomingId && requestIdPattern.test(incomingId)
    ? incomingId
    : randomUUID();

  req.id = requestId;
  req.log = logger.child({ requestId });
  res.setHeader('x-request-id', requestId);
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
