import v1Router from './v1.js';

/**
 * Proxy legacy /api/* requests to v1 handlers with deprecation headers.
 * Mount after app.use('/api/v1', v1Router) and before the 404 handler.
 */
export function legacyApiShim(req, res, next) {
  if (req.path === '/v1' || req.path.startsWith('/v1/')) {
    return next();
  }

  const queryIndex = req.url.indexOf('?');
  const query = queryIndex >= 0 ? req.url.slice(queryIndex) : '';
  const successorPath = `/api/v1${req.path}${query}`;

  res.set('Deprecation', 'true');
  res.set('Link', `<${successorPath}>; rel="successor-version"`);
  res.set('Warning', '299 - "Legacy /api/* path; use /api/v1/*"');

  const savedUrl = req.url;
  req.url = `${req.path}${query}`;
  v1Router(req, res, (err) => {
    req.url = savedUrl;
    if (err) {
      return next(err);
    }
    if (!res.headersSent) {
      next();
    }
  });
}
