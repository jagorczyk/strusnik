import { expect, test } from '@playwright/test';

const polishDiacritics = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

test.describe('legal copy and account required state', () => {
  test('landing legal links are plain ASCII and have no underline', async ({ page }) => {
    await page.goto('/');

    const links = page.locator('.site-legal-links a');
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toHaveText('Regulamin');
    await expect(links.nth(1)).toHaveText('Polityka prywatnosci');
    await expect(links.nth(0)).toHaveCSS('text-decoration-line', 'none');
    await expect(links.nth(1)).toHaveCSS('text-decoration-line', 'none');
  });

  test('login and legal pages do not render Polish diacritics', async ({ page }) => {
    for (const route of ['/auth', '/terms', '/privacy']) {
      await page.goto(route);
      const text = await page.locator('main').innerText();
      expect(text, route).not.toMatch(polishDiacritics);
    }
  });

  test('account required state is centered on the profile page', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/profile', { waitUntil: 'networkidle' });

    const state = page.locator('.account-required-state');
    await expect(state).toBeVisible();
    const bounds = await state.boundingBox();
    const mainBounds = await page.locator('main').boundingBox();
    expect(bounds).not.toBeNull();
    expect(mainBounds).not.toBeNull();
    expect(Math.abs(bounds!.x + bounds!.width / 2 - 640)).toBeLessThan(2);
    expect(Math.abs(bounds!.y + bounds!.height / 2 - (mainBounds!.y + mainBounds!.height / 2))).toBeLessThan(2);
  });

  test('the same account state is used in the queue and friends panel', async ({ page }) => {
    await page.goto('/lobby/chess/queue', { waitUntil: 'networkidle' });
    await expect(page.locator('.account-required-state')).toBeVisible();
    await expect(page.locator('.message')).toHaveCount(0);

    await page.goto('/');
    await page.locator('[aria-controls="profile-menu-panel"]').click();
    await page.locator('[aria-controls="friends-panel"]').click();
    await expect(page.locator('#friends-panel .account-required-state')).toBeVisible();
  });

  test('multiplayer cards use balanced rows on large screens', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/multiplayer');

    const rows = await page.locator('.game-card').evaluateAll((cards) => {
      const positions = cards.map((card) => (card as HTMLElement).offsetTop);
      return new Set(positions).size;
    });

    expect(rows).toBe(2);
  });
});
