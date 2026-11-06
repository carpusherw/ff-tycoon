import { expect, test } from '@playwright/test';
import { PORTS } from '../src/rules/world';

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

    test('the phone map strip keeps every pin and port at least 32 px to tap', async ({ page }) => {
      await page.goto('./');
      await page.locator('.city-list button').first().click();
      const strip = page.locator('.map-strip');
      await expect(strip).toBeVisible();
      const { hits, scrollWidth, stripScrolls } = await page.evaluate(() => {
        const el = document.querySelector('.map-strip')!;
        return {
          hits: [...document.querySelectorAll('.pin-hit')].map((c) => {
            const r = c.getBoundingClientRect();
            return { port: c.getAttribute('data-hit'), w: r.width, h: r.height };
          }),
          scrollWidth: document.documentElement.scrollWidth,
          stripScrolls: el.scrollWidth > el.clientWidth,
        };
      });
      // The map is wider than the screen and scrolls inside its strip, never the page.
      expect(stripScrolls).toBe(true);
      expect(scrollWidth).toBe(375);
      // One hit circle per port: each pin and each plain port.
      expect(hits).toHaveLength(Object.keys(PORTS).length);
      for (const hit of hits) {
        expect(hit.w, hit.port!).toBeGreaterThanOrEqual(32);
        expect(hit.h, hit.port!).toBeGreaterThanOrEqual(32);
      }
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

test.describe('the Hire tooltip is one line on a laptop', () => {
  for (const locale of ['en-US', 'zh-TW']) {
    for (const viewport of [
      { width: 1280, height: 800 },
      { width: 1024, height: 768 },
    ]) {
      test.describe(`${locale} ${viewport.width}×${viewport.height}`, () => {
        test.use({ locale, viewport });

        test('every department', async ({ page }) => {
          await page.goto('./');
          await page.locator('.city-list button').first().click();
          for (const dept of ['sales', 'ops', 'accounting']) {
            await page.locator(`[data-hire-dept="${dept}"]`).hover();
            const tip = page.locator('.tooltip:not([hidden])');
            await expect(tip).toBeVisible();
            const { lines, inner, lineHeight } = await tip.evaluate((el) => {
              const label = el.querySelector('.tooltip-label')!;
              const style = getComputedStyle(el);
              return {
                lines: label.getClientRects().length,
                inner: el.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
                lineHeight: parseFloat(getComputedStyle(label).lineHeight),
              };
            });
            // One line box, and the tooltip's content is one line tall.
            expect(lines, dept).toBe(1);
            expect(inner, dept).toBeLessThan(lineHeight * 1.5);
            const box = (await tip.boundingBox())!;
            expect(box.x, dept).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width, dept).toBeLessThanOrEqual(viewport.width);
            await page.mouse.move(0, 0);
            await expect(tip).toBeHidden();
          }
        });
      });
    }
  }
});
