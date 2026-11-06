import { expect, test, type Locator, type Page } from '@playwright/test';
import { t } from '../src/i18n';
import { PORTS } from '../src/rules/world';
import { fullNetwork, lateOperations, savedGame, seedSave } from './saves';

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

const LAPTOP = { width: 1280, height: 800 };
const PHONE = { width: 375, height: 812 };
const LANGS = [
  ['en-US', 'en'],
  ['zh-TW', 'zh-Hant'],
  ['zh-CN', 'zh-Hans'],
] as const;

/** Continues the seeded save in any language, pauses it, and waits for the web fonts and the layout they bring. */
async function continuePaused(page: Page): Promise<void> {
  await page.goto('./');
  await page.locator('.screen-card > .btn-wide').click();
  const pause = page.locator('.speed-btn').first();
  await pause.click();
  await expect(pause).toHaveAttribute('aria-pressed', 'true');
  await settle(page);
}

/**
 * Fonts loaded, every animation that ends (the sheet sliding up; clouds and waves go on forever) finished, and two
 * frames drawn since.
 */
async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const ending = document.getAnimations().filter((a) => a.effect?.getComputedTiming().endTime !== Infinity);
    await Promise.all(ending.map((a) => a.finished.catch(() => undefined)));
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
type Label = Rect & { port: string };

/** Overlapping by more than half a pixel each way; labels that only touch don't count. */
const intersects = (a: Rect, b: Rect) =>
  a.x + 0.5 < b.x + b.w && b.x + 0.5 < a.x + a.w && a.y + 0.5 < b.y + b.h && b.y + 0.5 < a.y + a.h;

/** Every label the map shows (pin bubbles and port names), with the port it names, as drawn on the page. */
function labelBoxes(page: Page): Promise<Label[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('.map-card .pin-bubble, .map-card .port-label')].flatMap((el) => {
      const port = el.closest('[data-label-for]')?.getAttribute('data-label-for');
      const r = el.getBoundingClientRect();
      return port && r.width > 0 ? [{ port, x: r.x, y: r.y, w: r.width, h: r.height }] : [];
    }),
  );
}

function expectNoOverlaps(boxes: Label[]) {
  for (const [i, a] of boxes.entries()) {
    for (const b of boxes.slice(i + 1)) expect(intersects(a, b), `${a.port} and ${b.port} overlap`).toBe(false);
  }
}

/** Clicks the middle of an element, as a player aims at a port's dot. */
async function clickMiddle(page: Page, target: Locator): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  const box = (await target.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

/** The text sits on one line, and the element's content box is one line tall. */
async function expectOneLine(target: Locator, what: string): Promise<void> {
  const { lines, inner, lineHeight } = await target.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const style = getComputedStyle(el);
    return {
      lines: new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size,
      inner: el.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
      lineHeight: parseFloat(style.lineHeight),
    };
  });
  expect(lines, what).toBe(1);
  expect(inner, what).toBeLessThan(lineHeight * 1.5);
}

/** The popup's two buttons (or the "Signed … ✓" line in the Sign agent button's place), each one line tall. */
async function expectButtonsOneLine(popup: Locator): Promise<void> {
  const buttons = popup.locator('.pop-actions .pop-btn');
  await expect(buttons).toHaveCount(2);
  for (const button of await buttons.all()) await expectOneLine(button, (await button.textContent())!);
}

const popupBox = async (popup: Locator): Promise<Rect> => {
  const r = (await popup.boundingBox())!;
  return { x: r.x, y: r.y, w: r.width, h: r.height };
};

test.describe('a big network on the map', () => {
  for (const [locale, lang] of LANGS) {
    test.describe(locale, () => {
      test.use({ locale });

      test.describe('laptop', () => {
        test.use({ viewport: LAPTOP });

        test('every pin label shows and no two labels overlap', async ({ page }) => {
          await seedSave(page, fullNetwork());
          await continuePaused(page);
          await expect(page.getByTestId('pin-office')).toHaveCount(4);
          await expect(page.getByTestId('pin-agent')).toHaveCount(Object.keys(PORTS).length - 4);
          const boxes = await labelBoxes(page);
          expect(boxes.map((b) => b.port).sort(), lang).toEqual(Object.keys(PORTS).sort());
          expectNoOverlaps(boxes);
        });
      });

      test.describe('phone', () => {
        test.use({ viewport: PHONE });

        test('the strip labels that show do not overlap', async ({ page }) => {
          await seedSave(page, fullNetwork());
          await continuePaused(page);
          await expect(page.locator('.map-strip')).toBeVisible();
          const boxes = await labelBoxes(page);
          expect(boxes.length, lang).toBeGreaterThan(0);
          expectNoOverlaps(boxes);
        });

        test('no horizontal scroll with three tabs and four offices in the switcher', async ({ page }) => {
          await seedSave(page, fullNetwork());
          await continuePaused(page);
          await expect(page.locator('.tabs [role="tab"]')).toHaveCount(3);
          await expect(page.locator('.office-switch')).toBeVisible();
          await expect(page.locator('.office-switch .office-tab')).toHaveCount(4);
          // The game screen clips what overflows it, so the page itself never scrolls; what it shows must fit too.
          // Only what sits in a strip that scrolls sideways (the map, the office list) may reach past the screen.
          const { scrollWidth, innerWidth, offScreen } = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
            offScreen: [...document.querySelectorAll('.game *')].flatMap((el) => {
              const r = el.getBoundingClientRect();
              if (r.width === 0 || r.height === 0) return [];
              for (let a = el.parentElement; a && !a.matches('.game'); a = a.parentElement) {
                if (['auto', 'scroll'].includes(getComputedStyle(a).overflowX)) return [];
              }
              return r.left < -0.5 || r.right > window.innerWidth + 0.5 ? [`${el.tagName}.${el.getAttribute('class')}: ${r.left}–${r.right}`] : [];
            }),
          }));
          expect(scrollWidth, lang).toBeLessThanOrEqual(innerWidth);
          expect(offScreen, lang).toEqual([]);
        });
      });
    });
  }
});

test.describe('the pin popup', () => {
  for (const [locale, lang] of LANGS) {
    test.describe(locale, () => {
      test.use({ locale });

      test.describe('laptop', () => {
        test.use({ viewport: LAPTOP });

        test('buttons stay one line, and signing leaves the box as it was', async ({ page }) => {
          // Day 500 of the Shanghai run: over $150,000 in cash, and Durban not covered yet.
          await seedSave(page, savedGame(500));
          await continuePaused(page);
          await clickMiddle(page, page.locator('.port-btn[data-port="DUR"] circle.port'));
          const popup = page.locator('.pin-pop.is-anchored');
          await expect(popup).toBeVisible();
          await expect(popup.locator('.pop-actions button:disabled')).toHaveCount(0);
          await settle(page);
          await expectButtonsOneLine(popup);
          const before = await popupBox(popup);
          expect(before.w * before.h, lang).toBeGreaterThan(0);

          await popup.locator('.btn-agent').click();
          await expect(popup.locator('.pop-actions .pop-signed')).toBeVisible();
          await settle(page);
          await expectButtonsOneLine(popup);
          const after = await popupBox(popup);
          for (const side of ['x', 'y', 'w', 'h'] as const) {
            expect(Math.abs(after[side] - before[side]), `${side}: ${before[side]} → ${after[side]}`).toBeLessThanOrEqual(1);
          }
        });
      });

      test.describe('phone', () => {
        test.use({ viewport: PHONE });

        test('a bottom sheet under the map, with one-line buttons', async ({ page }) => {
          await seedSave(page, savedGame(500));
          await continuePaused(page);
          await clickMiddle(page, page.locator('.port-btn[data-port="DUR"] circle.port'));
          const sheet = page.locator('.pin-pop.is-sheet');
          await expect(sheet).toBeVisible();
          await settle(page);
          await expectButtonsOneLine(sheet);
          const { card, pop, backdrop, innerWidth, innerHeight } = await page.evaluate(() => {
            const rect = (selector: string) => {
              const r = document.querySelector(selector)!.getBoundingClientRect();
              return { top: r.top, right: r.right, bottom: r.bottom, left: r.left };
            };
            return {
              card: rect('.map-card'),
              pop: rect('.pin-pop'),
              backdrop: rect('.pop-backdrop'),
              innerWidth: window.innerWidth,
              innerHeight: window.innerHeight,
            };
          });
          // Across the foot of the screen and below the map card; its backdrop covers only what's below the card too.
          expect(pop.left, lang).toBe(0);
          expect(pop.right, lang).toBe(innerWidth);
          expect(Math.abs(pop.bottom - innerHeight), lang).toBeLessThanOrEqual(1);
          expect(pop.top, lang).toBeGreaterThanOrEqual(card.bottom - 0.5);
          expect(backdrop.top, lang).toBeGreaterThanOrEqual(card.bottom - 0.5);

          await sheet.locator('.btn-agent').click();
          await expect(sheet.locator('.pop-actions .pop-signed')).toBeVisible();
          await expectButtonsOneLine(sheet);
        });
      });
    });
  }
});

test.describe('the crowded Southeast Asia pins each open their own popup', () => {
  const CLUSTER = ['SIN', 'SGN', 'LCH', 'JKT'] as const;
  for (const [device, use] of [
    ['laptop', { viewport: LAPTOP }],
    ['phone', { viewport: PHONE, hasTouch: true, isMobile: true }],
  ] as const) {
    test.describe(device, () => {
      test.use(use);

      test('from a press at the middle of each pin head', async ({ page }) => {
        await seedSave(page, fullNetwork());
        await continuePaused(page);
        for (const port of CLUSTER) {
          const head = page.locator(`.pin[data-port="${port}"] .pin-focus`);
          await head.scrollIntoViewIfNeeded();
          const box = (await head.boundingBox())!;
          const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
          if (device === 'phone') await page.touchscreen.tap(x, y);
          else await page.mouse.click(x, y);
          const popup = page.getByRole('dialog', { name: t('en', PORTS[port].cityKey) });
          await expect(popup, port).toBeVisible();
          await page.keyboard.press('Escape');
          await expect(popup, port).toBeHidden();
        }
      });
    });
  }
});

test.describe('the Hire button stays put', () => {
  for (const viewport of [LAPTOP, PHONE]) {
    test.describe(`${viewport.width} px`, () => {
      test.use({ viewport });

      test('with the owner in Operations or elsewhere, and with or without a late badge', async ({ page }) => {
        // Taipei's Operations has a late task and nobody in it; Singapore is a second office with nobody at all.
        await seedSave(page, lateOperations());
        await continuePaused(page);
        if (viewport === PHONE) await page.getByRole('tab', { name: /^Operations/ }).click();
        const ops = page.getByRole('region', { name: 'Operations', exact: true });
        const hire = ops.locator('[data-hire-dept="ops"]');
        const late = ops.locator('.dept-late');
        const here = ops.getByText('You work here');
        const xs: number[] = [];
        const record = async () => xs.push((await hire.boundingBox())!.x);

        await expect(late).toBeVisible();
        await expect(here).toHaveCount(0);
        await record();
        await page.keyboard.press('o');
        await expect(here).toBeVisible();
        await expect(late).toBeVisible();
        await record();
        await page.keyboard.press(']');
        await expect(page.locator('.office-tab[aria-pressed="true"]')).toContainText('Singapore');
        await expect(late).toHaveCount(0);
        await expect(here).toHaveCount(0);
        await record();
        await page.keyboard.press('o');
        await expect(here).toBeVisible();
        await record();

        for (const x of xs) expect(Math.abs(x - xs[0]), `x positions ${xs.join(', ')}`).toBeLessThanOrEqual(0.5);
      });
    });
  }
});
