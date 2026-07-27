import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
  },
  expect: {
    timeout: 10_000,
  },
  projects: [
    {
      name: 'academy-fixture',
      testMatch: /academy-external\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run fixture:academy:v2',
      url: 'http://127.0.0.1:8081/api/v1/public/academy/access/e2e-token',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173/training/e2e-token',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        VITE_ACADEMY_V2: 'true',
        VITE_API_URL: 'http://127.0.0.1:8081/api/v1',
      },
    },
  ],
});
