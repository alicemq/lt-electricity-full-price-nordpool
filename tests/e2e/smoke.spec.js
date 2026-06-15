import { test, expect } from '@playwright/test';

test.describe('frontend smoke', () => {
  test('home redirects to upcoming', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/upcoming/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('today page loads', async ({ page }) => {
    await page.goto('/today');
    await expect(page).toHaveURL(/\/today/);
    await expect(page.locator('.today-page')).toBeVisible();
  });

  test('settings page loads', async ({ page }) => {
    await page.goto('/settings?lang=lt');
    await expect(page.getByRole('heading', { name: 'Nustatymai', exact: true })).toBeVisible();
  });

  test('API health via frontend proxy', async ({ request }) => {
    const response = await request.get('/api/v1/health');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body).toHaveProperty('overallStatus');
  });
});
