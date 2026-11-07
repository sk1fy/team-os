import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testMatch: /auth-coordinator\.spec\.ts/,
  workers: 1,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4186',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node scripts/auth-coordinator-fixture-server.mjs',
      url: 'http://127.0.0.1:4187/control',
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4186',
      url: 'http://127.0.0.1:4186/e2e/fixtures/auth.html',
      env: { VITE_API_MODE_AUTH: 'http', VITE_API_URL: 'http://127.0.0.1:4187/api/v1' },
    },
  ],
});
