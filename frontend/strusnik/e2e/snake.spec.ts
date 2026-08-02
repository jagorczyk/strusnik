import { expect, test } from '@playwright/test';

test('does not repeat the game started notice after eating food', async ({ page }) => {
  await page.goto('/singleplayer/Snake');

  // Put the first food directly in front of the initial head.
  await page.evaluate(() => {
    Math.random = () => 37 / 78;
  });

  await page.getByRole('button', { name: 'GRAJ' }).click();
  await expect(page.locator('.game-runtime-game > div').first()).toContainText('WYNIK: 100');
  await expect(page.locator('.notification-toast__message')).toHaveCount(1);
  await expect(page.locator('.notification-toast__message')).toHaveText('ROZPOCZETO GRE.');
});
