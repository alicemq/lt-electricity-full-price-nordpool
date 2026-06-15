import { test, expect } from '@playwright/test';

const LOADING_TEXT = 'Kraunamos kainos...';

test.describe('frontend smoke', () => {
  test('home redirects to upcoming', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/upcoming/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('upcoming page loads price table or empty state', async ({ page }) => {
    await page.goto('/upcoming?lang=lt');
    await expect(page).toHaveURL(/\/upcoming/);
    await expect(page.getByText(LOADING_TEXT)).toBeHidden({ timeout: 20_000 });

    const table = page.locator('table.table');
    const empty = page.getByText('Nėra artimiausių kainų.');
    await expect(table.or(empty)).toBeVisible();

    if (await table.isVisible()) {
      await expect(page.getByText('Vidutinė kaina:')).toBeVisible();
      await expect(table.locator('tbody tr').first()).toBeVisible();
    }
  });

  test('today page loads with date controls and price table', async ({ page }) => {
    await page.goto('/today?lang=lt');
    await expect(page).toHaveURL(/\/today/);
    const todayPage = page.locator('.today-page');
    await expect(todayPage).toBeVisible();
    await expect(todayPage.getByRole('button', { name: 'Šiandien' })).toBeVisible();
    await expect(todayPage.getByRole('button', { name: 'Rytoj' })).toBeVisible();
    await expect(page.getByText(LOADING_TEXT)).toBeHidden({ timeout: 20_000 });
    await expect(page.locator('table.table')).toBeVisible({ timeout: 20_000 });
  });

  test('settings page loads alert and color sections', async ({ page }) => {
    await page.goto('/settings?lang=lt');
    await expect(page.getByRole('heading', { name: 'Nustatymai', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Spalvų slenksčiai' })).toBeVisible();
    await expect(page.getByLabel('Pigi kaina')).toBeVisible();
    await expect(page.getByLabel('Brangi kaina')).toBeVisible();
  });

  test('bottom navigation switches between today and upcoming', async ({ page }) => {
    await page.goto('/upcoming?lang=lt');
    const nav = page.locator('nav.bottom-menu');

    await nav.getByRole('button', { name: 'Šiandien' }).click();
    await expect(page).toHaveURL(/\/today/);
    await expect(page.locator('.today-page')).toBeVisible();

    await nav.getByRole('button', { name: 'Artimiausios' }).click();
    await expect(page).toHaveURL(/\/upcoming/);
    await expect(page.getByText(LOADING_TEXT)).toBeHidden({ timeout: 20_000 });
  });

  test('bottom navigation opens settings from upcoming', async ({ page }) => {
    await page.goto('/upcoming?lang=lt');
    await page.locator('nav.bottom-menu').getByRole('button', { name: 'Nustatymai' }).click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByLabel('Pigi kaina')).toBeVisible({ timeout: 20_000 });
  });

  test('API health via frontend proxy', async ({ request }) => {
    const response = await request.get('/api/v1/health');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body).toHaveProperty('overallStatus');
  });
});
