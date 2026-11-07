import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import type {} from './fixtures/auth';
const controlUrl = 'http://127.0.0.1:4187/control';
const family = '10000000-0000-4000-8000-000000000001';
const newFamily = '20000000-0000-4000-8000-000000000002';
async function control(request: APIRequestContext, value: unknown) {
  await request.post(controlUrl, { data: value });
}
async function requests(request: APIRequestContext) {
  return (await request.get(controlUrl)).json() as Promise<
    Array<{ path: string; sessionId: string }>
  >;
}
async function open(page: Page, suffix = '') {
  await page.goto(`/e2e/fixtures/auth.html${suffix}`);
  await page.waitForFunction(() => Boolean(window.authFixture));
}
async function login(page: Page) {
  await page.evaluate(() =>
    window.authFixture.api.login({ login: 'fixture', password: 'fixture' }),
  );
}
test.beforeEach(async ({ request }) => {
  await control(request, { reset: true });
});

test('two pages hold one real Web Lock through refresh JSON and logout wins immediately', async ({
  context,
  page,
  request,
}) => {
  const second = await context.newPage();
  await open(page);
  await login(page);
  await open(second);
  await control(request, { plan: { path: '/auth/refresh', gate: 'body' } });
  const refreshing = page.evaluate(() => window.authFixture.refreshSession());
  await expect
    .poll(async () => (await requests(request)).filter((r) => r.path === '/auth/refresh').length)
    .toBe(1);
  const loggingOut = second.evaluate(() => window.authFixture.api.logout());
  await expect
    .poll(() => page.evaluate(() => window.authFixture.store.getState().accessToken))
    .toBeNull();
  expect((await requests(request)).filter((r) => r.path === '/auth/logout')).toHaveLength(0);
  await control(request, { release: 'body' });
  expect((await refreshing).kind).toBe('superseded');
  await loggingOut;
  expect((await requests(request)).filter((r) => r.path === '/auth/logout')).toEqual([
    { path: '/auth/logout', sessionId: family },
  ]);
  expect(await page.evaluate(() => window.authFixture.store.getState().accessToken)).toBeNull();
});

test('two explicit logins serialize until the first complete body and late login cannot undo logout', async ({
  context,
  page,
  request,
}) => {
  const second = await context.newPage();
  await open(page);
  await open(second);
  await control(request, { plan: { path: '/auth/login', gate: 'entry' } });
  const first = page.evaluate(() =>
    window.authFixture.api.login({ login: 'one', password: 'x' }).catch((e: Error) => e.message),
  );
  await expect
    .poll(async () => (await requests(request)).filter((r) => r.path === '/auth/login').length)
    .toBe(1);
  const other = second.evaluate(() =>
    window.authFixture.api.login({ login: 'two', password: 'x' }).catch((e: Error) => e.message),
  );
  await expect
    .poll(() => page.evaluate(() => navigator.locks.query().then((r) => r.pending.length)))
    .toBe(1);
  expect((await requests(request)).filter((r) => r.path === '/auth/login')).toHaveLength(1);
  const out = second.evaluate(() => window.authFixture.api.logout());
  await control(request, { release: 'entry' });
  await first;
  await other;
  await out;
  expect(await page.evaluate(() => window.authFixture.store.getState().accessToken)).toBeNull();
  expect(
    (await requests(request))
      .filter((r) => r.path === '/auth/logout')
      .some((r) => r.sessionId === family),
  ).toBe(true);
});

test('lost refresh response remains retryable and recovers without signing out', async ({
  page,
  request,
}) => {
  await open(page);
  await login(page);
  await control(request, { plan: { path: '/auth/refresh', drop: true } });
  expect(await page.evaluate(() => window.authFixture.refreshSession().then((r) => r.kind))).toBe(
    'unavailable',
  );
  expect(await page.evaluate(() => window.authFixture.store.getState().accessToken)).toBe(
    'fixture-access',
  );
  expect(await page.evaluate(() => window.authFixture.refreshSession().then((r) => r.kind))).toBe(
    'ready',
  );
});

test('pending logout reload and online retry keep the captured family, then permit fresh login', async ({
  page,
  request,
}) => {
  await open(page);
  await login(page);
  await control(request, { plan: { path: '/auth/logout', status: 503 } });
  await page.evaluate(() => window.authFixture.api.logout().catch(() => undefined));
  await control(request, { plan: { path: '/auth/logout', status: 503 } });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.authFixture));
  await expect
    .poll(async () => (await requests(request)).filter((r) => r.path === '/auth/logout').length)
    .toBe(2);
  expect(await page.evaluate(() => window.authFixture.store.getState().accessToken)).toBeNull();
  expect((await requests(request)).some((r) => r.path === '/auth/refresh')).toBe(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect
    .poll(async () => (await requests(request)).filter((r) => r.path === '/auth/logout').length)
    .toBe(3);
  await control(request, {
    plan: {
      path: '/auth/login',
      body: { accessToken: 'new-login', sessionId: newFamily, user: { id: 'new-user' } },
    },
  });
  await login(page);
  expect(await page.evaluate(() => window.authFixture.store.getState().accessToken)).toBe(
    'new-login',
  );
  expect(
    (await requests(request))
      .filter((r) => r.path === '/auth/logout')
      .every((r) => r.sessionId === family),
  ).toBe(true);
});

test('bootstrap 503 shows Russian retry state and completes after retry', async ({
  page,
  request,
}) => {
  await control(request, { plan: { path: '/auth/refresh', status: 503 } });
  await open(page, '?bootstrap');
  await expect(page.getByRole('alert')).toContainText('Не удалось проверить доступ');
  await page.getByRole('button', { name: 'Повторить' }).click();
  await expect(page.getByText('Доступ восстановлен')).toBeVisible();
});

test('unsupported Web Locks constrains session creation explicitly', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined }));
  await open(page);
  expect(
    await page.evaluate(() =>
      window.authFixture.api
        .login({ login: 'x', password: 'x' })
        .catch((e: { code: string }) => e.code),
    ),
  ).toBe('AUTH_COORDINATION_UNAVAILABLE');
});

test('an old request failure cannot retry under a new login in another page', async ({
  context,
  page,
  request,
}) => {
  await open(page);
  await login(page);
  const second = await context.newPage();
  await open(second);
  await control(request, { plan: { path: '/work', status: 401, gateBefore: 'old-failure' } });
  const old = page.evaluate(() =>
    window.authFixture.httpRequest('/work').catch((e: { code: string }) => e.code),
  );
  await expect
    .poll(async () => (await requests(request)).filter((r) => r.path === '/work').length)
    .toBe(1);
  await control(request, {
    plan: {
      path: '/auth/login',
      body: { accessToken: 'new-account', sessionId: newFamily, user: { id: 'new-user' } },
    },
  });
  await login(second);
  await control(request, { release: 'old-failure' });
  expect(await old).toBe('AUTH_SUPERSEDED');
  expect((await requests(request)).filter((r) => r.path === '/work')).toHaveLength(1);
  expect((await requests(request)).some((r) => r.path === '/auth/refresh')).toBe(false);
  expect(await second.evaluate(() => window.authFixture.store.getState().accessToken)).toBe(
    'new-account',
  );
});

test('initial selector discovery logout revokes the newly learned family', async ({
  context,
  page,
  request,
}) => {
  await open(page);
  const other = await context.newPage();
  await open(other);
  await control(request, { plan: { path: '/auth/refresh', gate: 'initial-body' } });
  const restoring = page.evaluate(() => window.authFixture.refreshSession());
  await expect
    .poll(async () => (await requests(request)).filter((r) => r.path === '/auth/refresh').length)
    .toBe(1);
  const out = other.evaluate(() => window.authFixture.api.logout());
  await expect
    .poll(() => page.evaluate(() => window.authFixture.store.getState().accessToken))
    .toBeNull();
  await control(request, { release: 'initial-body' });
  expect((await restoring).kind).toBe('superseded');
  await out;
  expect((await requests(request)).filter((r) => r.path === '/auth/logout')).toEqual([
    { path: '/auth/logout', sessionId: family },
  ]);
});

test('successful old body cannot populate cache after another page logs in', async ({
  context,
  page,
  request,
}) => {
  await open(page);
  await login(page);
  const other = await context.newPage();
  await open(other);
  await control(request, {
    plan: { path: '/work', gate: 'private-body', body: { privateOldAccount: true } },
  });
  const old = page.evaluate(() =>
    window.authFixture.httpRequest('/work').catch((e: { code: string }) => e.code),
  );
  await expect
    .poll(async () => (await requests(request)).filter((r) => r.path === '/work').length)
    .toBe(1);
  await login(other);
  await control(request, { release: 'private-body' });
  expect(await old).toBe('AUTH_SUPERSEDED');
});

test('denied storage and failed logout cannot restore cookies on reload', async ({
  page,
  request,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, 'getItem', {
      value: () => {
        throw new Error('denied');
      },
    });
    Object.defineProperty(Storage.prototype, 'setItem', {
      value: () => {
        throw new Error('denied');
      },
    });
  });
  await open(page);
  await control(request, { plan: { path: '/auth/logout', status: 503 } });
  await page.evaluate(() => window.authFixture.api.logout().catch(() => undefined));
  await open(page, '?bootstrap');
  await expect(page.getByRole('alert')).toContainText('Не удалось проверить доступ');
  expect((await requests(request)).some((r) => r.path === '/auth/refresh')).toBe(false);
});

test('lost initial discovery keeps default-selector logout pending until it succeeds', async ({
  page,
  request,
}) => {
  await open(page);
  await control(request, { plan: { path: '/auth/refresh', drop: true } });
  expect(await page.evaluate(() => window.authFixture.refreshSession().then((r) => r.kind))).toBe(
    'unavailable',
  );
  await control(request, { plan: { path: '/auth/logout', status: 503 } });
  await page.evaluate(() => window.authFixture.logoutSession().catch(() => undefined));
  await page.reload();
  await page.waitForFunction(() => Boolean(window.authFixture));
  await expect
    .poll(async () => (await requests(request)).filter((r) => r.path === '/auth/logout').length)
    .toBe(2);
  expect(
    (await requests(request))
      .filter((r) => r.path === '/auth/logout')
      .every((r) => r.sessionId === null),
  ).toBe(true);
  expect(await page.evaluate(() => window.authFixture.store.getState().accessToken)).toBeNull();
});

test('a cross-tab login clears cached private data in both pages', async ({ context, page }) => {
  await open(page);
  await login(page);
  const other = await context.newPage();
  await open(other);
  for (const target of [page, other]) {
    await target.evaluate(() =>
      window.authFixture.queryClient.setQueryData(['tasks'], { privateOldAccount: true }),
    );
  }
  await login(other);
  await expect
    .poll(() => page.evaluate(() => window.authFixture.queryClient.getQueryData(['tasks'])))
    .toBeUndefined();
  expect(
    await other.evaluate(() => window.authFixture.queryClient.getQueryData(['tasks'])),
  ).toBeUndefined();
});
