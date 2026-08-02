import { expect, test } from '@playwright/test';

test('loads blackjack chips and keeps the table inside a small viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/singleplayer/Blackjack');

  await expect(page.getByText(/Invalid src prop/)).toHaveCount(0);
  await page.getByRole('button', { name: 'DODAJ ZETON O WARTOSCI 5$' }).click();
  await page.getByRole('button', { name: 'ROZDAJ KARTY' }).click();

  const table = page.locator('.blackjack-table');
  await expect(table).toBeVisible();
  const bounds = await table.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(568);
});
