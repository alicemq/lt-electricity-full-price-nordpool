import { test, expect } from '@playwright/test';
import { expectLegacyDeprecationHeaders, resolveApiBase } from './helpers/apiBase.js';

const apiBase = resolveApiBase();

test.describe('API contracts', () => {
  test('legacy sync status includes Deprecation header', async ({ request }) => {
    const response = await request.get(`${apiBase}/api/sync/status`);
    expect(response.ok()).toBeTruthy();
    expectLegacyDeprecationHeaders(response.headers(), '/api/v1/sync/status');
  });

  test('legacy nps prices includes Deprecation header', async ({ request }) => {
    const response = await request.get(`${apiBase}/api/nps/prices?country=lt&date=2024-06-15`);
    expect(response.ok()).toBeTruthy();
    const headers = response.headers();
    expectLegacyDeprecationHeaders(headers, '/api/v1/nps/prices');
    expect(headers.link).toMatch(/country=lt/);
  });

  test('v1 health responds OK', async ({ request }) => {
    const response = await request.get(`${apiBase}/api/v1/health`);
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.overallStatus).toBeTruthy();
  });

  test('v1 sync status has no Deprecation header', async ({ request }) => {
    const response = await request.get(`${apiBase}/api/v1/sync/status`);
    expect(response.ok()).toBeTruthy();
    const headers = response.headers();
    expect(headers.deprecation).toBeUndefined();
  });
});
