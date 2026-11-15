const { createProxyMiddleware } = require('http-proxy-middleware');
const { env } = require('./config');

function createServiceProxy(serviceName, target, pathFilter, pathRewrite) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathFilter,
    pathRewrite,
    on: {
      proxyReq(proxyReq, req) {
        proxyReq.setHeader('x-request-id', req.id);
        proxyReq.removeHeader('x-user-id');
        if (req.userId) {
          proxyReq.setHeader('x-user-id', req.userId);
        }
      },
      error(error, req, res) {
        req.log.error({ err: error, service: serviceName }, 'Upstream proxy failed');
        if (!res.headersSent) {
          return res.status(502).json({
            error: {
              code: 'UPSTREAM_UNAVAILABLE',
              message: 'An upstream service is unavailable',
            },
            requestId: req.id,
          });
        }
        return res.end();
      },
    },
  });
}

const authProxy = createServiceProxy(
  'auth-service',
  env.AUTH_SERVICE_URL,
  (path) => path === '/api/auth' || path.startsWith('/api/auth/'),
  (path) => path.replace(/^\/api\/auth/, ''),
);

const transactionProxy = createServiceProxy(
  'transaction-service',
  env.TRANSACTION_SERVICE_URL,
  (path) => path === '/api/transactions' || path.startsWith('/api/transactions/'),
  (path) => path.replace(/^\/api/, ''),
);

const notificationProxy = createServiceProxy(
  'notification-service',
  env.NOTIFICATION_SERVICE_URL,
  (path) => path === '/api/notifications' || path.startsWith('/api/notifications/'),
  (path) => path
    .replace(/^\/api\/notifications\/settings\/threshold/, '/settings/threshold')
    .replace(/^\/api/, ''),
);

module.exports = { authProxy, transactionProxy, notificationProxy };
