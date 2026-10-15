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
async function fixture(page: Page, state = 'installed', conflict = false) {
  const calls: { path: string; method: string }[] = [];
  let draft = {
    scope,
    revision: 1,
    schemaVersion: 1,
    checksum: 'a'.repeat(64),
    rules: [] as unknown[],
    updatedAt: new Date().toISOString(),
    updatedBy: id,
  };
  const publications: unknown[] = [];
  await page.route('**/api/v1/**', async (route) => {
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
        if (conflict) {
          status = 409;
          data = { error: { message: 'Ревизия изменилась', status } };
        } else {
          draft = {
            ...draft,
            revision: draft.revision + 1,
            rules: route.request().postDataJSON().rules,
          };
          data = draft;
        }
      } else data = draft;
    } else if (path.endsWith('/publications')) {
      if (method === 'POST') {
        data = {
          ...draft,
          id,
          version: 1,
          draftRevision: draft.revision,
          reason: route.request().postDataJSON().reason,
          createdAt: new Date().toISOString(),
          createdBy: id,
        };
        publications.unshift(data);
      } else data = { items: publications };
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  });
  return calls;
}
for (const width of [1440, 390])
  test(`draft and publish ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    const calls = await fixture(page);
    await page.goto('/task-control');
    await expect(page.getByText('Виджет установлен', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Добавить правило', exact: true }).click();
    await page.getByLabel('Название', { exact: true }).fill('Контроль новых сделок');
    await page.getByLabel('ID пользователей amoCRM (через запятую)').fill('42, 43');
    await page.getByLabel('Проверять покупателей', { exact: true }).check();
    await page.getByRole('button', { name: 'Сохранить черновик', exact: true }).click();
    await expect(page.getByText('Черновик сохранён.', { exact: false })).toBeVisible();
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1); // auth refresh only
    await page.getByLabel('Комментарий к публикации').fill('Первый пилот');
    await page.getByRole('button', { name: 'Опубликовать сохранённый черновик' }).click();
    await expect(page.getByText('Последняя версия: 1.', { exact: false })).toBeVisible();
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
  const calls = await fixture(page, 'installed', true);
  await page.goto('/task-control');
  await page.getByRole('button', { name: 'Добавить правило', exact: true }).click();
  await page.getByLabel('Название', { exact: true }).fill('Не потерять');
  await page.getByRole('button', { name: 'Сохранить черновик', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Ревизия изменилась');
  await expect(page.getByLabel('Название', { exact: true })).toHaveValue('Не потерять');
  expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(1);
});
