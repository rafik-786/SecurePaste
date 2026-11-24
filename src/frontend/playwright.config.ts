import { defineConfig, devices } from '@playwright/test';
import { SOURCE_URL } from './e2e/buildEnv';

const PORT = Number(process.env.E2E_PORT ?? 4180);
const OUT_DIR = process.env.E2E_OUT_DIR ?? 'dist';
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;
const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'e2e',
  ...(process.env.E2E_RESULTS_DIR ? { outputDir: process.env.E2E_RESULTS_DIR } : {}),
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
    command: `npm run build -- --outDir "${OUT_DIR}" --emptyOutDir && npm run preview -- --outDir "${OUT_DIR}" --host ${HOST} --port ${PORT} --strictPort`,
    url: BASE_URL,
    // Production sets a source link, and without one there is no footer to lay out.
    env: { VITE_SOURCE_URL: SOURCE_URL },
    reuseExistingServer: !isCi,
    timeout: 120_000,
  },
});
