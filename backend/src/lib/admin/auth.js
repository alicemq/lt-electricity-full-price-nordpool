/**
 * Admin API token gate. Set ADMIN_API_TOKEN in the environment.
 */
export function requireAdminToken(req, res, next) {
  const configuredToken = process.env.ADMIN_API_TOKEN;
  if (!configuredToken) {
    return res.status(503).json({
      success: false,
      error: 'Admin API not configured',
      code: 'ADMIN_NOT_CONFIGURED',
    });
  }

  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const headerToken = req.headers['x-admin-token'];
  const provided = bearerToken || headerToken;

  if (!provided || provided !== configuredToken) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      code: 'ADMIN_UNAUTHORIZED',
    });
  }

  req.adminActor = req.headers['x-admin-actor'] || 'admin-api';
  next();
}
