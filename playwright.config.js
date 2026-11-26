// E2E 設定。webServer は依存なしの scripts/serve.mjs（127.0.0.1 のみ）
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: './tests/e2e',
  forbidOnly: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], browserName: 'chromium' } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
  ],
  webServer: {
    command: `node scripts/serve.mjs --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/tests/fixtures/site/index.html`,
    reuseExistingServer: false,
    timeout: 15_000,
  },
});
