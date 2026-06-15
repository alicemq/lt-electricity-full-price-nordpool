import { test, expect } from '@playwright/test';

const apiBase = process.env.API_URL || 'http://127.0.0.1:3000';

test.describe('API contracts', () => {
  test('legacy sync status includes Deprecation header', async ({ request }) => {
    const response = await request.get(`${apiBase}/api/sync/status`);
    expect(response.ok()).toBeTruthy();
    const headers = response.headers();
    expect(headers.deprecation).toBe('true');
    expect(headers.link).toMatch(/successor-version/);
    expect(headers.link).toMatch(/\/api\/v1\/sync\/status/);
  });

  test('v1 health responds OK', async ({ request }) => {
    const response = await request.get(`${apiBase}/api/v1/health`);
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.overallStatus).toBeTruthy();
  });
});
