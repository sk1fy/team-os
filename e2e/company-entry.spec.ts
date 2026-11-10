import { expect, test } from '@playwright/test';
const code = 'x'.repeat(43);
test.beforeEach(async ({ page }) => {
  await page.route(/\/(auth\/amo|simulate-old-auth-failure)$/, async (route) => {
    const response = await page.request.get('/e2e/fixtures/company-entry.html');
    await route.fulfill({ response });
  });
});
test('real StrictMode page removes fragment before one exchange, replaces auth and tenant queries', async ({
  page,
}) => {
  let calls = 0;
  await page.route('**/api/v1/auth/amocrm/entry-exchange', async (route) => {
    calls++;
    expect(route.request().postDataJSON()).toEqual({ code });
    expect(route.request().headers().authorization).toBeUndefined();
    expect(new URL(page.url()).hash).toBe('');
    await route.fulfill({
      json: {
        accessToken: 'own-admin-token',
        sessionId: '10000000-0000-4000-8000-000000000001',
        user: { id: 'own-admin', companyId: 'own-company', role: 'admin' },
      },
    });
  });
  await page.goto(`/auth/amo#code=${code}`);
  await expect(page.getByTestId('entered')).toContainText('own-admin');
  await expect(page.getByTestId('entered')).toContainText('"oldTenant":null');
  await expect(page.getByTestId('entered')).toContainText('own-admin-token');
  expect(calls).toBe(1);
  expect(new URL(page.url()).pathname).toBe('/employees');
});
test('exchange error leaves code scrubbed and returns to widget without password fallback or replay', async ({
  page,
}) => {
  let calls = 0;
  await page.route('**/api/v1/auth/amocrm/entry-exchange', async (route) => {
    calls++;
    await route.fulfill({ status: 403, json: { error: { message: 'Denied', status: 403 } } });
  });
  await page.goto(`/auth/amo#code=${code}`);
  await expect(page.getByText('Не удалось войти в компанию')).toBeVisible();
  await expect(page.getByText(/Вернитесь в настройки виджета/)).toBeVisible();
  await expect(page.locator('input[type=password],a[href*="login"],button')).toHaveCount(0);
  expect(new URL(page.url()).hash).toBe('');
  expect(calls).toBe(1);
});
test('missing fragment does not exchange or refresh an old session', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/auth/')) requests.push(request.url());
  });
  await page.goto('/auth/amo');
  await expect(page.getByText('Не удалось войти в компанию')).toBeVisible();
  expect(requests).toEqual([]);
});

test('an unavailable previous session refresh cannot block the public handoff route', async ({
  page,
}) => {
  let exchanges = 0;
  await page.route('**/api/v1/auth/refresh', (route) =>
    route.fulfill({ status: 503, json: { error: { message: 'Unavailable' } } }),
  );
  await page.route('**/api/v1/auth/amocrm/entry-exchange', async (route) => {
    exchanges++;
    await route.fulfill({ status: 403, json: { error: { message: 'Denied' } } });
  });
  await page.goto('/simulate-old-auth-failure');
  await expect(
    page.getByText('Не удалось проверить доступ. Проверьте соединение и попробуйте ещё раз.'),
  ).toBeVisible();
  await page.evaluate((code) => {
    window.history.pushState({}, '', '/auth/amo#code=' + code);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, code);
  await expect(page.getByText('Не удалось войти в компанию')).toBeVisible();
  expect(exchanges).toBe(1);
  expect(new URL(page.url()).hash).toBe('');
});
