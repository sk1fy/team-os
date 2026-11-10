import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testMatch: /company-entry\.spec\.ts/,
  workers: 1,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4190',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4190',
    url: 'http://127.0.0.1:4190/e2e/fixtures/company-entry.html',
    env: { VITE_API_MODE_AUTH: 'http', VITE_API_URL: '/api/v1' },
  },
});
