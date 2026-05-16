import { defineConfig, devices } from '@playwright/test';

const apiPort = process.env.FULLSTACK_API_PORT || '3101';
const webPort = process.env.FULLSTACK_WEB_PORT || '5174';

export default defineConfig({
  testDir: './e2e',
  testMatch: /onboarding-fullstack\.spec\.ts/,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  globalTeardown: './e2e/teardown-fullstack-db.mjs',
  use: {
    baseURL: process.env.TEST_BASE_URL || `http://localhost:${webPort}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: `PORT=${apiPort} node e2e/start-fullstack-api.mjs`,
      url: `http://localhost:${apiPort}/api/v1/system/status`,
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: `VITE_API_URL=http://localhost:${apiPort} npm run dev -- --host 127.0.0.1 --port ${webPort}`,
      url: `http://localhost:${webPort}`,
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
