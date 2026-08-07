import { test, expect } from '@playwright/test';

const publicRoutes = ['/', '/multiplayer', '/singleplayer', '/rankings', '/changelog', '/settings'];

test.describe('mobile layout contract', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
  });

  for (const route of publicRoutes) {
    test(`${route} keeps the document reachable without horizontal overflow`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'networkidle' });

      const metrics = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        bodyWidth: document.body.scrollWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyZoom: getComputedStyle(document.body).zoom,
        documentScrollHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
      }));

      expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.viewportWidth);
      expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth);
      expect(metrics.bodyZoom).toBe('1');
      expect(metrics.documentScrollHeight).toBeGreaterThanOrEqual(metrics.viewportHeight);

      if (route === '/') {
        await expect(page.locator('.mobile-app-header')).toHaveCount(0);
      } else {
        await expect(page.locator('.mobile-app-header')).toBeVisible();
      }
    });
  }

  test('landscape mobile uses the real viewport scale', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 360 });
    await page.goto('/games/haxball/test-room', { waitUntil: 'domcontentloaded' });

    const metrics = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      bodyWidth: document.body.scrollWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyZoom: getComputedStyle(document.body).zoom,
    }));

    expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.bodyZoom).toBe('1');
    await expect(page.locator('.mobile-app-header')).toBeVisible();
  });
});
