import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL;
const localApiTarget = process.env.E2E_LOCAL_API_TARGET;
if (!baseURL) {
  throw new Error('E2E_BASE_URL is required for the real-backend Academy suite');
}

export default defineConfig({
  testDir: './e2e',
  testMatch: /academy-staging\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 45_000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: localApiTarget
    ? {
        command: 'npm run dev -- --host 127.0.0.1 --port 4174',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        env: {
          VITE_API_URL: `${baseURL.replace(/\/$/, '')}/api/v1`,
          VITE_PROXY_API_TARGET: localApiTarget,
          VITE_ACADEMY_V2: 'true',
          VITE_API_MODE_AUTH: 'http',
          VITE_API_MODE_ORG: 'http',
          VITE_API_MODE_KB: 'http',
          VITE_API_MODE_TASKS: 'http',
          VITE_API_MODE_ACADEMY: 'http',
          VITE_API_MODE_NOTIFICATIONS: 'http',
          VITE_API_MODE_SCHEDULE: 'http',
          VITE_API_MODE_DISTRIBUTION: 'http',
        },
      }
    : undefined,
});
