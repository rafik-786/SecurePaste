import { defineConfig, devices } from '@playwright/test';

const PORT = 4180;
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;
const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  reporter: isCi ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --host ${HOST} --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !isCi,
    timeout: 120_000,
  },
});
