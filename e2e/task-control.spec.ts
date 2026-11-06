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
const references = {
  scope,
  revision: '1',
  fetchedAt: new Date().toISOString(),
  freshUntil: new Date(Date.now() + 300000).toISOString(),
  complete: true,
  users: [
    { id: '42', name: 'Ольга Новикова', active: true },
    { id: '43', name: 'Анна Смирнова', active: true },
    { id: '44', name: 'Пётр Уволенный', active: false },
  ],
  pipelines: [
    {
      id: '7',
      name: 'Продажи',
      statuses: [
        { id: '71', name: 'Первичный контакт' },
        { id: '72', name: 'Переговоры' },
        { id: '142', name: 'Успешно реализовано' },
        { id: '143', name: 'Закрыто и не реализовано' },
      ],
    },
    { id: '8', name: 'Опт', statuses: [{ id: '81', name: 'Новая заявка' }] },
  ],
  customersSupported: true,
  customerStatuses: [{ id: '91', name: 'Повторная покупка' }],
  sourceSnapshotId: id,
};
async function fixture(
  page: Page,
  state = 'installed',
  failure?: 'conflict' | 'lost-response' | 'stale-references',
  options: { references?: unknown; linked?: boolean; history?: unknown } = {},
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
      data =
        options.linked === false
          ? []
          : [
              {
                scope,
                state: 'active',
                mode: 'standalone',
                installation,
                updatedAt: new Date().toISOString(),
              },
            ];
    else if (path.endsWith('/references')) data = options.references ?? [];
    else if (path.endsWith('/history')) data = options.history ?? [];
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
const addRule = (page: Page) =>
  page.getByRole('button', { name: 'Добавить правило', exact: true }).click();
// Редактор правила — панель справа: правки попадают в список по «Готово»,
// в виджет — по «Сохранить правила» на плашке несохранённых изменений.
const closeEditor = (page: Page) =>
  page.getByRole('button', { name: 'Готово', exact: true }).click();
const openRule = (page: Page, name: string) =>
  page.getByRole('button', { name, exact: true }).click();

for (const width of [1440, 390])
  test(`save applies rules ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    const { calls, saves } = await fixture(page);
    await page.goto('/task-control');
    await expect(page.getByRole('button', { name: 'Добавить правило', exact: true })).toBeEnabled();
    await addRule(page);
    await page.getByLabel('Название', { exact: true }).fill('Контроль новых сделок');
    await page.getByLabel('ID пользователей amoCRM (через запятую)').fill('42, 43');
    await page.getByLabel('Проверять покупателей', { exact: true }).check();
    await expect(page.getByRole('heading', { name: 'Публикация' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Источник правил' })).toHaveCount(0);
    await closeEditor(page);
    await expect(page.getByRole('region', { name: 'Несохранённые изменения' })).toContainText(
      '1 изменение не сохранено',
    );
    await page.getByRole('button', { name: 'Сохранить правила', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Правила сохранены.');
    expect(saves).toHaveLength(1);
    expect(saves[0].applyRequestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(saves[0].rules).toMatchObject([
      { name: 'Контроль новых сделок', users: ['42', '43'], customers: true },
    ]);
    expect(calls.some(({ path }) => /publications|mode-intents/.test(path))).toBe(false);
    await expect(page.getByRole('region', { name: 'Несохранённые изменения' })).toHaveCount(0);
    await openRule(page, 'Контроль новых сделок');
    await page.getByLabel('Название', { exact: true }).fill('Контроль повторных сделок');
    await closeEditor(page);
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
  await addRule(page);
  await page.getByLabel('Название', { exact: true }).fill('Не потерять');
  await closeEditor(page);
  await page.getByRole('button', { name: 'Сохранить правила', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Ревизия изменилась');
  await openRule(page, 'Не потерять');
  await expect(page.getByLabel('Название', { exact: true })).toHaveValue('Не потерять');
  expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(1);
});

test('a manual retry reuses the save identity after a lost response', async ({ page }) => {
  const { saves } = await fixture(page, 'installed', 'lost-response');
  await page.goto('/task-control');
  await page.getByRole('button', { name: 'Добавить правило' }).click();
  await page.getByLabel('Название', { exact: true }).fill('Сохранить один раз');
  await closeEditor(page);
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
  await closeEditor(page);
  await page.getByRole('button', { name: 'Сохранить правила' }).click();
  await expect(page.getByRole('status')).toContainText('Правила сохранены.');
  expect(saves).toHaveLength(2);
  expect(saves[0].applyRequestId).toBe(saves[1].applyRequestId);
  expect(
    calls.filter(({ path }) => path.includes('/references/refresh')).map(({ method }) => method),
  ).toEqual(['POST', 'GET']);
});

test('discarding unsaved edits restores the saved rules without writes', async ({ page }) => {
  const { calls } = await fixture(page);
  await page.goto('/task-control');
  await addRule(page);
  await page.getByLabel('Название', { exact: true }).fill('Черновая мысль');
  await closeEditor(page);
  await expect(page.getByRole('button', { name: 'Черновая мысль', exact: true })).toBeVisible();
  await page
    .getByRole('region', { name: 'Несохранённые изменения' })
    .getByRole('button', { name: 'Отменить' })
    .click();
  await expect(page.getByRole('button', { name: 'Черновая мысль', exact: true })).toHaveCount(0);
  await expect(page.getByText('Правил пока нет')).toBeVisible();
  expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(0);
});

test('rules editor picks CRM users and stages by name', async ({ page }) => {
  const { saves } = await fixture(page, 'installed', undefined, { references });
  await page.goto('/task-control');
  await addRule(page);
  await page.getByLabel('Название', { exact: true }).fill('Продажи под контролем');
  await expect(page.getByLabel('ID пользователей amoCRM (через запятую)')).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Найти пользователя' }).fill('ольга');
  await page.getByRole('checkbox', { name: /Ольга Новикова/ }).check();
  await expect(page.getByRole('checkbox', { name: /Пётр Уволенный/ })).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Найти пользователя' }).fill('');
  await expect(page.getByRole('checkbox', { name: /Пётр Уволенный/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Показать этапы Продажи' }).click();
  await page.getByRole('checkbox', { name: /Переговоры/ }).check();
  await expect(page.getByRole('checkbox', { name: /Успешно реализовано/ })).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Воронка Опт', exact: true }).check();
  await page.getByLabel('Запрещать выход без задачи', { exact: true }).check();
  await closeEditor(page);
  const row = page.getByRole('row', { name: /Продажи под контролем/ });
  await expect(row).toContainText('Ольга Новикова');
  await expect(row).toContainText('Продажи · Переговоры');
  await expect(row).toContainText('Опт · вся воронка');
  await expect(row).toContainText('Нельзя выйти: ответственный');
  await page.getByRole('button', { name: 'Сохранить правила', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Правила сохранены.');
  expect(saves[0].rules).toMatchObject([
    {
      name: 'Продажи под контролем',
      users: ['42'],
      pipelines: [
        { pipelineId: '7', statusIds: ['72'] },
        { pipelineId: '8', statusIds: ['81'] },
      ],
      denyExit: true,
    },
  ]);
});

test('connection tab shows account status and refreshes it', async ({ page }) => {
  const entry = (action: string, at: string) => ({
    id: crypto.randomUUID(),
    scope,
    actorId: id,
    action,
    createdAt: at,
    reason: '',
    actorType: 'user',
  });
  const { calls } = await fixture(page, 'installed', undefined, {
    history: {
      items: [entry('draftUpdated', '2026-11-05T09:30:00Z'), entry('link', '2026-11-01T08:00:00Z')],
    },
  });
  await page.goto('/task-control?tab=connection');
  await expect(page.getByText('Виджет установлен', { exact: true })).toBeVisible();
  await expect(page.getByText('Аккаунт amoCRM 123')).toBeVisible();
  await expect(page.getByText(id).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Добавить правило' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Журнал' })).toBeVisible();
  await expect(page.getByText('Правила сохранены', { exact: true })).toBeVisible();
  await expect(page.getByText('Правила TeamOS подключены', { exact: true })).toBeVisible();
  const installationCalls = () => calls.filter(({ path }) => path.endsWith('/installation')).length;
  const before = installationCalls();
  await page.getByRole('button', { name: 'Обновить статус' }).click();
  await expect.poll(installationCalls).toBeGreaterThan(before);
});

test('rules lead to the connection tab until TeamOS rules are linked', async ({ page }) => {
  await fixture(page, 'installed', undefined, { linked: false });
  await page.goto('/task-control');
  await expect(page.getByText('Правила ещё недоступны')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Добавить правило', exact: true })).toBeDisabled();
  await page.getByRole('link', { name: 'Перейти к подключению' }).click();
  await expect(page).toHaveURL(/\/task-control\?tab=connection$/);
  await expect(page.getByLabel('Код подключения')).toBeVisible();
  await page.getByLabel('Код подключения').fill('not-a-code');
  await page.getByRole('button', { name: 'Подключить' }).click();
  await expect(page.getByRole('alert')).toContainText('Код истёк');
});
