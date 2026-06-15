import { expect } from '@playwright/test';

/**
 * Resolve a reachable backend base URL for direct API contract tests.
 * Legacy /api/* routes MUST hit the backend (not the Vite/nginx swagger proxy).
 */
export function resolveApiBase() {
  if (process.env.API_URL) {
    return process.env.API_URL.replace(/\/$/, '');
  }

  const candidates = [
    process.env.LOCAL_API_URL,
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3003',
  ].filter(Boolean);

  return candidates[0]?.replace(/\/$/, '') || 'http://127.0.0.1:3000';
}

export function expectLegacyDeprecationHeaders(headers, successorPath) {
  expect(headers.deprecation).toBe('true');
  expect(headers.link).toMatch(/successor-version/);
  expect(headers.link).toMatch(new RegExp(successorPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  expect(headers.warning).toMatch(/Legacy \/api\/\* path/);
}
