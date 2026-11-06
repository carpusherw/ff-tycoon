import { expect, test, type Page } from '@playwright/test';
import { PORTS } from '../src/rules/world';

/** The phone map as drawn: its hit circles, the map's size, whether its strip scrolls, and the page's width. */
function mapLayout(page: Page) {
  return page.evaluate(() => {
    const strip = document.querySelector('.map-strip')!;
    const map = document.querySelector('.world-map')!.getBoundingClientRect();
    return {
      hits: [...document.querySelectorAll('.pin-hit')].map((c) => {
        const r = c.getBoundingClientRect();
        return { port: c.getAttribute('data-hit'), w: r.width, h: r.height };
      }),
      map: { w: map.width, h: map.height },
      scrollWidth: document.documentElement.scrollWidth,
      stripScrolls: strip.scrollWidth > strip.clientWidth,
    };
  });
}

/** One hit circle per port (each pin and each plain port), each at least 32 px across. */
function expectHitTargets(hits: { port: string | null; w: number; h: number }[]) {
  expect(hits).toHaveLength(Object.keys(PORTS).length);
  for (const hit of hits) {
    expect(hit.w, hit.port!).toBeGreaterThanOrEqual(32);
    expect(hit.h, hit.port!).toBeGreaterThanOrEqual(32);
  }
}

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
      await expect(page.locator('.map-strip')).toBeVisible();
      const { hits, map, scrollWidth, stripScrolls } = await mapLayout(page);
      // The map is drawn 1.6× the screen's width and scrolls inside its strip, never the page.
      expect(Math.abs(map.w - 1.6 * 375), `map width ${map.w}`).toBeLessThanOrEqual(1);
      expect(stripScrolls).toBe(true);
      expect(scrollWidth).toBe(375);
      expectHitTargets(hits);
    });
  });
}

test.describe('a landscape phone', () => {
  test.use({ viewport: { width: 740, height: 375 } });

  test('keeps the map short, the tabs and board reachable, and every hit target 32 px', async ({ page }) => {
    await page.goto('./');
    await page.locator('.city-list button').first().click();
    await expect(page.locator('.map-strip')).toBeVisible();
    const { hits, map, scrollWidth } = await mapLayout(page);
    // At most about 40% of the screen's height.
    expect(map.h, `map height ${map.h}`).toBeLessThanOrEqual(0.4 * 375 + 1);
    expect(scrollWidth).toBe(740);
    expectHitTargets(hits);
    // The tabs and the board can still be reached and used.
    const money = page.getByRole('tab', { name: 'Money' });
    await money.scrollIntoViewIfNeeded();
    await expect(money).toBeInViewport();
    await money.click();
    await expect(money).toHaveAttribute('aria-selected', 'true');
    const offices = page.getByRole('tab', { name: 'Offices' });
    await offices.click();
    const hire = page.getByRole('button', { name: /^Hire · / }).first();
    await hire.scrollIntoViewIfNeeded();
    await expect(hire).toBeInViewport();
  });
});

test.describe('a touch on a port dot under a pin', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test('opens that port: Shanghai in a Taipei game', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'Taipei' }).click();
    await page.keyboard.press('Space');
    // Shanghai's dot sits just under the Taipei pin's head.
    const dot = (await page.locator('.port-btn[data-port="SHA"] circle.port').boundingBox())!;
    await page.touchscreen.tap(dot.x + dot.width / 2, dot.y + dot.height / 2);
    await expect(page.getByRole('dialog', { name: 'Shanghai' })).toBeVisible();
  });
});

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
