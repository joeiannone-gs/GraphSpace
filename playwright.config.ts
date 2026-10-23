import { defineConfig, devices } from '@playwright/test';

// Locally, point PW_CHROMIUM_PATH at an existing Chromium/headless-shell binary to skip `playwright install`.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;
const port = Number(process.env.E2E_PORT || 3100);

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    launchOptions: { executablePath },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && node .next/standalone/server.js`,
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: { HOSTNAME: '127.0.0.1', PORT: String(port), DATABASE_PATH: process.env.E2E_DATABASE_PATH || 'data/e2e.db', INVITE_CODE: 'e2e-invite' },
  },
});
