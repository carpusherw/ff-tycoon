import { expect, test, type Page } from '@playwright/test';
import { BACKUP_KEY, SAVE_KEY } from '../src/app/persistence';
import type { GameState } from '../src/rules/types';
import { savedGame } from './saves';

/** Stores `state` as the saved game before the page loads. */
async function seedSave(page: Page, state: GameState): Promise<void> {
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [SAVE_KEY, JSON.stringify(state)]);
}

const dayShown = async (page: Page) => Number(await page.locator('.num-day').textContent());
const staffShown = (page: Page) =>
  page.locator('.pill').filter({ has: page.getByText('staff', { exact: true }) }).locator('b');

test('new game runs', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Taipei' }).click();
  await page.keyboard.press('5');
  await expect(page.getByRole('button', { name: '5×' })).toHaveAttribute('aria-pressed', 'true');

  await expect.poll(() => dayShown(page), { timeout: 10_000 }).toBeGreaterThanOrEqual(10);
  await expect(page.locator('li.task').first()).toBeVisible();
  await expect(staffShown(page)).toHaveText('1');

  await page.getByRole('button', { name: /^Sales · / }).click();
  const dialog = page.getByRole('dialog', { name: 'Hiring · Sales' });
  await dialog.getByRole('button', { name: 'Hire', exact: true }).first().click();
  await expect(dialog.getByRole('status')).toContainText('Hired');
  await expect(staffShown(page)).toHaveText('2');
});

test('ships appear at sea', async ({ page }) => {
  await seedSave(page, savedGame(200));
  await page.goto('./');
  await page.getByRole('button', { name: 'Continue your company' }).click();
  await expect(page.getByTestId('ship').first()).toBeVisible();
});

test('a new game over a saved run asks first and keeps a backup', async ({ page }) => {
  await seedSave(page, savedGame(200));
  await page.goto('./');
  const stored = (key: string) => page.evaluate((k) => window.localStorage.getItem(k), key);
  const raw = await stored(SAVE_KEY);

  await page.getByRole('button', { name: 'Taipei' }).click();
  const dialog = page.getByRole('dialog', { name: 'Start a new game? Your current run (Year 1, Day 200) will be replaced.' });
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  expect(await stored(SAVE_KEY)).toBe(raw);
  expect(await stored(BACKUP_KEY)).toBeNull();

  await page.getByRole('button', { name: 'Taipei' }).click();
  await dialog.getByRole('button', { name: 'Start new game' }).click();
  await expect(page.getByRole('group', { name: 'Game speed' })).toBeVisible();
  expect(await stored(BACKUP_KEY)).toBe(raw);
  expect(await stored(SAVE_KEY)).not.toBe(raw);
});

test('end screen offers the demo', async ({ page }) => {
  await seedSave(page, savedGame(3599));
  await page.goto('./');
  await page.getByRole('button', { name: 'Continue your company' }).click();
  await expect(page.getByRole('button', { name: '1×' })).toHaveAttribute('aria-pressed', 'true');
  // 8 s: the last day takes 1 s at 1×, then the fireworks (2.5 s) and the fade (0.6 s), plus slack for slow runners.
  await expect(page.getByRole('heading', { name: 'Ten years in business!' })).toBeVisible({ timeout: 8_000 });
  const demo = page.getByRole('link', { name: 'Book a demo with GoFreight' });
  await expect(demo).toHaveAttribute('href', 'https://gofreight.com/get-demo');
  await expect(demo).toHaveAttribute('target', '_blank');
  await expect(demo).toHaveAttribute('rel', 'noopener noreferrer');
});

test('survives broken storage', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error('storage is blocked');
    };
  });
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Start your forwarding company' })).toBeVisible();
  await page.getByRole('button', { name: 'Taipei' }).click();
  await expect(page.getByRole('group', { name: 'Game speed' })).toBeVisible();
  await expect.poll(() => dayShown(page), { timeout: 5_000 }).toBeGreaterThanOrEqual(1);
});
