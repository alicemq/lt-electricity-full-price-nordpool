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

  test('upcoming grid includes the active 15-min slot', async ({ page }) => {
    const frozenNow = new Date('2026-06-16T03:48:00+03:00');
    const slot = (hour, minute) =>
      Math.floor(new Date(`2026-06-16T${hour}:${minute}:00+03:00`).getTime() / 1000);
    const cachePayload = {
      version: 1,
      data: {
        lt: [
          { timestamp: slot('03', '30'), price: 41.1 },
          { timestamp: slot('03', '45'), price: 42.2 },
          { timestamp: slot('04', '00'), price: 43.3 },
          { timestamp: slot('04', '15'), price: 44.4 },
          { timestamp: slot('04', '30'), price: 45.5 },
        ],
      },
      lastUpdated: slot('03', '45'),
    };

    await page.clock.install({ time: frozenNow });
    await page.addInitScript((payload) => {
      localStorage.setItem('priceDataCache', JSON.stringify(payload));
    }, cachePayload);

    await page.goto('/upcoming?lang=lt');
    await expect(page.getByText(LOADING_TEXT)).toBeHidden({ timeout: 20_000 });

    const table = page.locator('table.table');
    await expect(table).toBeVisible();
    await expect(table.locator('tbody tr')).toHaveCount(2);
    await expect(table.locator('tbody tr').first()).toContainText('03');
    await expect(table.locator('tbody tr').first()).toContainText('45');
  });

  test('today page loads with date controls and price or empty state', async ({ page }) => {
    await page.goto('/today?lang=lt');
    await expect(page).toHaveURL(/\/today/);
    const todayPage = page.locator('.today-page');
    await expect(todayPage).toBeVisible();
    await expect(todayPage.getByRole('button', { name: 'Šiandien' })).toBeVisible();
    await expect(todayPage.getByRole('button', { name: 'Rytoj' })).toBeVisible();
    await expect(page.getByText(LOADING_TEXT)).toBeHidden({ timeout: 20_000 });

    const dateInput = todayPage.getByRole('combobox', { name: 'Datepicker input' });
    await expect(dateInput).toBeVisible();
    await expect(dateInput).toHaveValue(/\d{4}-\d{2}-\d{2}/);

    const table = page.locator('table.table');
    const emptyWarning = page.getByText('Šiai datai kainų duomenys dar nepasiekiami.');
    await expect(table.or(emptyWarning)).toBeVisible();

    if (await table.isVisible()) {
      await expect(page.getByText('Vidutinė kaina:')).toBeVisible();
      await expect(table.locator('tbody tr').first()).toBeVisible();
      await expect(page.getByText('0.000 ct/kWh')).toHaveCount(0);
    } else {
      await expect(page.getByText('0.000 ct/kWh')).toHaveCount(0);
    }
  });

  test('today tomorrow button keeps date visible in empty-data window', async ({ page }) => {
    await page.goto('/today?lang=lt');
    const todayPage = page.locator('.today-page');
    await expect(page.getByText(LOADING_TEXT)).toBeHidden({ timeout: 20_000 });

    await todayPage.getByRole('button', { name: 'Rytoj' }).click();
    await expect(page.getByText(LOADING_TEXT)).toBeHidden({ timeout: 20_000 });

    const dateInput = todayPage.getByRole('combobox', { name: 'Datepicker input' });
    await expect(dateInput).toHaveValue(/\d{4}-\d{2}-\d{2}/);

    const table = page.locator('table.table');
    const emptyWarning = page.getByText('Šiai datai kainų duomenys dar nepasiekiami.');
    await expect(table.or(emptyWarning)).toBeVisible();
    await expect(page.getByText('0.000 ct/kWh')).toHaveCount(0);
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

  test('bottom navigation opens settings after today then upcoming', async ({ page }) => {
    await page.goto('/upcoming?lang=lt');
    const nav = page.locator('nav.bottom-menu');

    await nav.getByRole('button', { name: 'Šiandien' }).click();
    await expect(page).toHaveURL(/\/today/);
    await expect(page.locator('.today-page')).toBeVisible();

    await nav.getByRole('button', { name: 'Artimiausios' }).click();
    await expect(page).toHaveURL(/\/upcoming/);
    await expect(page.locator('.upcoming-page')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.today-page')).toHaveCount(0);

    await nav.getByRole('button', { name: 'Nustatymai' }).click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.locator('.today-page')).toHaveCount(0);
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
