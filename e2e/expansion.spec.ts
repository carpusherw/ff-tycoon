import { expect, test, type Locator, type Page } from '@playwright/test';
import { savedGame, seedSave } from './saves';

/** Clicks the middle of an element, as a player aims at a pin's head or a port's dot. */
async function clickMiddle(page: Page, target: Locator): Promise<void> {
  const box = (await target.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

const portDot = (page: Page, port: string) => page.locator(`.port-btn[data-port="${port}"] circle.port`);
const pinHead = (page: Page, port: string) => page.locator(`.pin[data-port="${port}"] .pin-focus`);
const switcher = (page: Page) => page.getByRole('group', { name: 'Offices' });
const column = (page: Page, name: string) => page.getByRole('region', { name, exact: true });

test('expanding from the map: sign an agent, open an office there, and both survive a reload', async ({ page }) => {
  // A Shanghai company on day 500 with ten agents, one office and over $150,000: Durban is not covered yet.
  await seedSave(page, savedGame(500));
  await page.goto('./');
  await page.getByRole('button', { name: 'Continue your company' }).click();
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.locator('.map-legend')).toContainText('Your offices · 1');
  await expect(page.locator('.map-legend')).toContainText('Agents · 10');
  await expect(switcher(page)).toHaveCount(0);

  // An uncovered port opens its popup; Sign agent puts a named agent pin there.
  await clickMiddle(page, portDot(page, 'DUR'));
  const popup = page.getByRole('dialog', { name: 'Durban' });
  await expect(popup).toBeVisible();
  await popup.getByRole('button', { name: 'Sign agent · $5,000' }).click();
  const signed = popup.getByRole('status').filter({ hasText: /^Signed .+ ✓$/ });
  await expect(signed).toBeVisible();
  const name = (await signed.textContent())!.replace(/^Signed (.+) ✓$/, '$1');
  const agentPin = page.locator('.pin[data-testid="pin-agent"][data-port="DUR"]');
  await expect(agentPin).toHaveAttribute('aria-label', `Durban: agent ${name}`);
  await expect(agentPin.locator('.pin-sub')).toHaveText(name);
  await expect(page.locator('.map-legend')).toContainText('Agents · 11');
  await page.keyboard.press('Escape');
  await expect(popup).toBeHidden();

  // That agent pin opens its own popup; Open office closes it and puts the new office on screen.
  await clickMiddle(page, pinHead(page, 'DUR'));
  await expect(popup).toBeVisible();
  await expect(popup).toContainText(`Agent: ${name}`);
  await popup.getByRole('button', { name: 'Open office · $50,000' }).click();
  await expect(popup).toBeHidden();
  await expect(page.locator('.pin[data-testid="pin-office"][data-port="DUR"]')).toHaveAttribute('aria-current', 'true');
  await expect(switcher(page)).toBeVisible();
  await expect(switcher(page).getByRole('button', { name: /Durban/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(switcher(page).getByRole('button', { name: /Shanghai/ })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.map-legend')).toContainText('Your offices · 2');

  // The new office's columns are empty, and Work here moves the owner into it.
  for (const dept of ['Sales', 'Operations', 'Accounting']) {
    await expect(column(page, dept).locator('.dept-empty'), dept).toBeVisible();
    await expect(column(page, dept).locator('li.task'), dept).toHaveCount(0);
  }
  const ops = column(page, 'Operations');
  await ops.getByRole('button', { name: 'Work here' }).click();
  await expect(ops.getByText('You work here')).toBeVisible();
  await expect(ops.locator('.dept-empty')).toHaveCount(0);
  await expect(switcher(page).getByRole('button', { name: /Durban/ }).locator('.star')).toBeVisible();
  await expect(switcher(page).getByRole('button', { name: /Shanghai/ }).locator('.star')).toHaveCount(0);

  // An own-office pin switches office straight away, with no popup.
  await clickMiddle(page, pinHead(page, 'SHA'));
  await expect(switcher(page).getByRole('button', { name: /Shanghai/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.pin[data-port="SHA"]')).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Reloading loads what the game saved: both offices, the agent, and the owner in Durban.
  await page.reload();
  await page.getByRole('button', { name: 'Continue your company' }).click();
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.locator('.map-legend')).toContainText('Your offices · 2');
  await expect(page.locator('.map-legend')).toContainText('Agents · 11');
  await expect(page.locator('.pin[data-testid="pin-office"][data-port="DUR"]')).toBeVisible();
  await expect(switcher(page).getByRole('button', { name: /Durban/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(switcher(page).getByRole('button', { name: /Shanghai/ })).toHaveAttribute('aria-pressed', 'false');
  // The office's pin stands in for the agent's, which the legend still counts and the log still names.
  await expect(page.locator('.log')).toContainText(`Signed ${name} as your agent in Durban.`);
});
