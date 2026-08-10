import { test, expect } from '@playwright/test';

test('multiplayer cards use right-sized image variants', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/multiplayer');

  const cards = page.locator('.game-card');
  await expect(cards).toHaveCount(6);

  const images = cards.locator('img');
  await images.evaluateAll((elements) => Promise.all(elements.map((element) => {
    if (element.complete) return Promise.resolve();
    return new Promise<void>((resolve) => element.addEventListener('load', () => resolve(), { once: true }));
  })));

  const details = await images.evaluateAll((elements) => elements.map((element) => ({
    loading: element.loading,
    source: element.currentSrc,
    sizes: element.sizes,
  })));

  expect(details.map((image) => image.loading)).toEqual(Array(6).fill('eager'));
  expect(details.map((image) => image.sizes)).toEqual(Array(6).fill('(max-width: 720px) 50vw, 320px'));
  expect(details.map((image) => new URL(image.source).searchParams.get('w'))).toEqual(Array(6).fill('256'));
});
