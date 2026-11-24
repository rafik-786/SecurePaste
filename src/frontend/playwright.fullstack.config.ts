import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.FULLSTACK_PORT ?? 4250);
const OUT_DIR = process.env.E2E_OUT_DIR ?? 'dist';
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;

// One worker and no retries: every test spends the API's per-minute create and claim budget, and a
// retry or a parallel burst would turn a real failure into a misleading 429.
export default defineConfig({
  testDir: 'e2e-fullstack',
  outputDir: process.env.E2E_RESULTS_DIR ?? 'test-results/fullstack',
  globalSetup: './e2e-fullstack/global-setup.ts',
  globalTeardown: './e2e-fullstack/global-teardown.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  webServer: {
    command: `npm run build -- --outDir "${OUT_DIR}" --emptyOutDir && npm run preview -- --outDir "${OUT_DIR}" --host ${HOST} --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
