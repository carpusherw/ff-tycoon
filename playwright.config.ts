import { defineConfig, devices } from '@playwright/test';

const BASE_URL = 'http://localhost:4173/ff-tycoon/';
const CI = Boolean(process.env.CI);
// A local Chromium to use instead of Playwright's own download (CI installs Playwright's).
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions: { executablePath } },
    },
  ],
  // Serves the production build (`npm run build` first), under the same base path as GitHub Pages.
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: BASE_URL,
    reuseExistingServer: !CI,
  },
});
