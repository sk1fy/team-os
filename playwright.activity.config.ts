import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testMatch: /activity-control\.spec\.ts/,
  workers: 1,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:4187',
    ...devices['Desktop Chrome'],
    locale: 'ru-RU',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4187',
    url: 'http://127.0.0.1:4187',
    reuseExistingServer: false,
    env: {
      VITE_API_URL: 'http://127.0.0.1:4187/api/v1',
      VITE_API_MODE_AUTH: 'http',
      VITE_API_MODE_ORG: 'http',
    },
  },
});
