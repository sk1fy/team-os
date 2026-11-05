import { test, expect, type Page } from '@playwright/test';
const id = '10000000-0000-4000-8000-000000000001';
const scope = {
  companyId: id,
  bindingId: id,
  bindingRevision: 1,
  installationId: id,
  integrationId: id,
  accountId: '123',
  product: 'task-control',
  modeEpoch: 1,
};
async function fixture(
  page: Page,
  state = 'installed',
  failure?: 'conflict' | 'lost-response' | 'stale-references',
) {
  const calls: { path: string; method: string }[] = [];
  const saves: { applyRequestId: string; expectedModeEpoch: number; rules: unknown[] }[] = [];
  let draft = {
    scope,
    revision: 1,
    schemaVersion: 1,
    checksum: 'a'.repeat(64),
    rules: [] as unknown[],
    updatedAt: new Date().toISOString(),
    updatedBy: id,
  };
  await page.route('**/api/v*/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    calls.push({ path, method });
    let data: unknown = [];
    let status = 200;
    const installation = {
      companyId: id,
      accountId: '123',
      product: 'task-control',
      state,
      revision: 1,
      generation: 1,
      installationId: id,
      integrationId: id,
      checkedAt: new Date().toISOString(),
      freshUntil: new Date(Date.now() + 300000).toISOString(),
    };
    if (path.endsWith('/auth/refresh')) data = { accessToken: 'fixture' };
    else if (path.endsWith('/auth/me'))
      data = {
        id,
        firstName: 'Анна',
        lastName: 'Тестовая',
        email: 'test@example.invalid',
        role: 'owner',
        status: 'active',
        departmentIds: [],
      };
    else if (path.endsWith('/company'))
      data = { id, name: 'Тестовая компания', amoAccountId: '123' };
    else if (path.endsWith('/installation')) data = installation;
    else if (path.endsWith('/connections'))
      data = [
        {
          scope,
          state: 'active',
          mode: 'standalone',
          installation,
          updatedAt: new Date().toISOString(),
        },
      ];
    else if (path.endsWith('/draft')) {
      if (method === 'PUT') {
        const input = route.request().postDataJSON();
        const previous =
          failure === 'lost-response' &&
          saves.find((save) => save.applyRequestId === input.applyRequestId);
        saves.push(input);
        if (failure === 'conflict') {
          status = 409;
          data = { error: { message: 'Ревизия изменилась', status } };
        } else if (failure === 'stale-references' && saves.length === 1) {
          status = 503;
          data = {
            error: { message: 'Требуется свежий справочник CRM', code: 'references_unavailable' },
          };
        } else {
          if (!previous) {
            draft = {
              ...draft,
              scope: { ...scope, modeEpoch: 2 },
              revision: draft.revision + 1,
              rules: input.rules,
            };
          }
          if (failure === 'lost-response' && saves.length === 1) {
            await route.abort();
            return;
          }
          data = draft;
        }
      } else data = draft;
    } else if (path.includes('/references/refresh')) {
      data = {
        refreshId: id,
        state: method === 'POST' ? 'pending' : 'completed',
        errorCode: null,
      };
      if (method === 'POST') status = 202;
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  });
  return { calls, saves };
}
for (const width of [1440, 390])
  test(`save applies rules ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    const { calls, saves } = await fixture(page);
    await page.goto('/task-control');
    await expect(page.getByText('Виджет установлен', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Добавить правило', exact: true }).click();
    await page.getByLabel('Название', { exact: true }).fill('Контроль новых сделок');
    await page.getByLabel('ID пользователей amoCRM (через запятую)').fill('42, 43');
    await page.getByLabel('Проверять покупателей', { exact: true }).check();
    await expect(page.getByRole('heading', { name: 'Публикация' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Источник правил' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Сохранить правила', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Правила сохранены.');
    expect(saves).toHaveLength(1);
    expect(saves[0].applyRequestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(calls.some(({ path }) => /publications|mode-intents/.test(path))).toBe(false);
    await page.getByLabel('Название', { exact: true }).fill('Контроль повторных сделок');
    await page.getByRole('button', { name: 'Сохранить правила', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Правила сохранены.');
    expect(saves[1].expectedModeEpoch).toBe(2);
    await page.screenshot({ path: info.outputPath(`task-control-${width}.png`), fullPage: true });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBeTruthy();
  });
for (const state of ['unknown', 'notInstalled'])
  test(`inactive ${state}`, async ({ page }) => {
    await fixture(page, state);
    await page.goto('/task-control');
    await expect(
      page.getByText(
        state === 'unknown' ? 'Статус установки неизвестен.' : 'Виджет не установлен.',
        { exact: false },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Добавить правило', exact: true }),
    ).toBeDisabled();
  });
test('conflict retains user edits and does not repeat writes', async ({ page }) => {
  const { calls } = await fixture(page, 'installed', 'conflict');
  await page.goto('/task-control');
  await page.getByRole('button', { name: 'Добавить правило', exact: true }).click();
  await page.getByLabel('Название', { exact: true }).fill('Не потерять');
  await page.getByRole('button', { name: 'Сохранить правила', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Ревизия изменилась');
  await expect(page.getByLabel('Название', { exact: true })).toHaveValue('Не потерять');
  expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(1);
});

test('a manual retry reuses the save identity after a lost response', async ({ page }) => {
  const { saves } = await fixture(page, 'installed', 'lost-response');
  await page.goto('/task-control');
  await page.getByRole('button', { name: 'Добавить правило' }).click();
  await page.getByLabel('Название', { exact: true }).fill('Сохранить один раз');
  const save = page.getByRole('button', { name: 'Сохранить правила' });
  await save.click();
  await expect(page.getByRole('alert')).toBeVisible();
  await save.click();
  await expect(page.getByRole('status')).toContainText('Правила сохранены.');
  expect(saves).toHaveLength(2);
  expect(saves[0].applyRequestId).toBe(saves[1].applyRequestId);
});

test('save refreshes stale CRM references and applies the same request', async ({ page }) => {
  const { calls, saves } = await fixture(page, 'installed', 'stale-references');
  await page.goto('/task-control');
  await page.getByRole('button', { name: 'Добавить правило' }).click();
  await page.getByLabel('Название', { exact: true }).fill('Правило с актуальными данными');
  await page.getByRole('button', { name: 'Сохранить правила' }).click();
  await expect(page.getByRole('status')).toContainText('Правила сохранены.');
  expect(saves).toHaveLength(2);
  expect(saves[0].applyRequestId).toBe(saves[1].applyRequestId);
  expect(
    calls.filter(({ path }) => path.includes('/references/refresh')).map(({ method }) => method),
  ).toEqual(['POST', 'GET']);
});
