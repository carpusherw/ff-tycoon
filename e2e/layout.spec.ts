import { expect, test } from '@playwright/test';

for (const locale of ['en-US', 'zh-TW', 'zh-CN']) {
  test.describe(locale, () => {
    test.use({ locale, viewport: { width: 375, height: 812 } });

    test('no horizontal scroll on a phone', async ({ page }) => {
      await page.goto('./');
      await page.locator('.city-list button').first().click();
      await expect(page.locator('.tabs')).toBeVisible();
      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
    });
  });
}

test.describe('language follows the browser', () => {
  for (const [locale, title] of [
    ['zh-TW', '創立你的貨代公司'],
    ['zh-CN', '创立你的货代公司'],
  ]) {
    test.describe(locale, () => {
      test.use({ locale });

      test(`shows ${title}`, async ({ page }) => {
        await page.goto('./');
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
      });
    });
  }
});

test.describe('dark mode follows the browser', () => {
  for (const colorScheme of ['dark', 'light'] as const) {
    test.describe(colorScheme, () => {
      test.use({ colorScheme });

      test(`gives the ${colorScheme} theme`, async ({ page }) => {
        await page.goto('./');
        await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme);
      });
    });
  }
});
