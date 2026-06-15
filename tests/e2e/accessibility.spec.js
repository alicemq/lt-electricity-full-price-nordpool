import { test, expect } from './fixtures/axe.js';

const LOADING_TEXT = 'Kraunamos kainos...';

test.describe('accessibility spot-check', () => {
  test('today has no critical a11y violations', async ({ page, makeAxeBuilder }) => {
    await page.goto('/today?lang=lt');
    await expect(page.getByText(LOADING_TEXT)).toBeHidden({ timeout: 20_000 });
    await expect(page.locator('table.table')).toBeVisible({ timeout: 20_000 });
    const results = await makeAxeBuilder().analyze();
    expect(results.violations.filter((v) => v.impact === 'critical')).toEqual([]);
  });

  test('settings has no critical a11y violations', async ({ page, makeAxeBuilder }) => {
    await page.goto('/settings?lang=lt');
    await expect(page.getByRole('heading', { name: 'Nustatymai', exact: true })).toBeVisible();
    await expect(page.getByLabel('Pigi kaina')).toBeVisible();
    const results = await makeAxeBuilder().analyze();
    expect(results.violations.filter((v) => v.impact === 'critical')).toEqual([]);
  });
});
