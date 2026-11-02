import { test, expect, type Page } from '@playwright/test';
const id = '10000000-0000-4000-8000-000000000001';
async function fixture(page: Page, state = 'configured', conflict = false) {
  const calls: {
    path: string;
    method: string;
    key: string | undefined;
    binding?: string;
    body: unknown;
  }[] = [];
  let panel = {
    id,
    name: 'Отдел продаж',
    employeeIds: [7],
    displayWindow: { from: '09:00', to: '18:00' },
    enabled: true,
    options: { pipelineIds: [], operators: [], departments: [] },
    revision: 1,
    timezone: 'Europe/Moscow',
    updatedAt: new Date().toISOString(),
    shareUrlIssued: true,
  };
  let task = {
    enabled: true,
    employeeIds: [7],
    considerFutureTasks: false,
    includeRelatedDeals: false,
    priorityKeys: ['urgent'],
    revision: 1,
  };
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const method = req.method();
    const body = req.postData() ? req.postDataJSON() : undefined;
    calls.push({
      path,
      method,
      key: req.headers()['idempotency-key'],
      binding: req.headers()['x-activity-binding-id'],
      body,
    });
    let data: unknown = [];
    let status = 200;
    if (path.endsWith('/auth/refresh')) data = { accessToken: 'fixture' };
    else if (path.endsWith('/auth/me'))
      data = {
        id,
        firstName: 'Анна',
        lastName: 'Тестовая',
        email: 'test@example.invalid',
        role: 'owner',
        status: 'active',
        positionIds: [],
        departmentIds: [],
      };
    else if (path.endsWith('/distribution/rules')) data = { items: [] };
    else if (path.includes('/distribution/queue'))
      data = { items: [], total: 0, limit: 15, offset: 0, hasMore: false };
    else if (path.endsWith('/company'))
      data = { id, name: 'Тестовая компания', amoAccountId: '123' };
    else if (path.endsWith('/activity-control/connection'))
      data =
        state === 'configured'
          ? {
              state,
              bindingId: id,
              scope: { companyId: id, installationId: id, integrationId: id, accountId: '123' },
            }
          : { state, message: 'Activity ещё не подключена' };
    else if (path.endsWith('/activity-control/employees'))
      data = {
        users: [{ id: 7, name: 'Анна Тестовая', groupId: 1, groupName: 'Продажи' }],
        pipelines: [],
        timezone: 'Europe/Moscow',
      };
    else if (path.endsWith('/activity-control/task-panel')) {
      if (method === 'PATCH') {
        task = { ...body, revision: task.revision + 1 };
      }
      data = task;
    } else if (path.endsWith('/share-link'))
      data = { ...panel, shareUrl: 'https://panel.example.invalid/#/view?key=issued' };
    else if (path.endsWith('/activity-control/panels')) {
      if (method === 'POST') {
        panel = { ...panel, ...body };
        data = { ...panel, shareUrl: 'https://panel.example.invalid/#/view?key=created' };
      } else data = { panels: [panel] };
    } else if (path.endsWith(`/activity-control/panels/${id}`)) {
      if (conflict) {
        status = 409;
        data = { error: { status, message: 'Настройки уже изменились. Обновите данные' } };
      } else {
        panel = { ...panel, ...body, revision: panel.revision + 1 };
        data = panel;
      }
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  });
  return calls;
}
for (const width of [1440, 390])
  test(`Activity shared settings ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const calls = await fixture(page);
    await page.goto('/activity-control');
    await expect(
      page.getByRole('heading', { name: 'Контроль активности', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Отдел продаж' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Открыть панель' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Настроить', exact: true }).click();
    await page.getByLabel('Название панели').fill('Общая панель');
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Общая панель' })).toBeVisible();
    await page.getByRole('button', { name: 'Новая ссылка' }).click();
    await page.getByRole('button', { name: 'Заменить ссылку', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Открыть панель' })).toHaveAttribute(
      'href',
      'https://panel.example.invalid/#/view?key=issued',
    );
    await page.screenshot({ path: info.outputPath(`panels-${width}.png`), fullPage: true });
    await page.getByRole('tab', { name: 'Панель задач виджета' }).click();
    await page.getByRole('switch', { name: 'Учитывать будущие задачи' }).click();
    await page.getByRole('button', { name: 'Сохранить настройки' }).click();
    await expect(page.getByRole('switch', { name: 'Учитывать будущие задачи' })).toBeChecked();
    expect(
      calls
        .filter((c) => c.path.includes('/activity-control/') && !c.path.endsWith('/connection'))
        .every((c) => c.binding === id),
    ).toBe(true);
    expect(calls.filter((c) => c.path.includes('share-link'))[0]?.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(calls.some((c) => c.path.includes('rakurs') || c.path.includes('ssd'))).toBe(false);
    await page.screenshot({ path: info.outputPath(`activity-${width}.png`), fullPage: true });
  });
test('revision conflict preserves the draft', async ({ page }) => {
  await fixture(page, 'configured', true);
  await page.goto('/activity-control');
  await page.getByRole('button', { name: 'Настроить', exact: true }).click();
  await page.getByLabel('Название панели').fill('Несохранённый черновик');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByText('Настройки уже изменились. Обновите данные')).toBeVisible();
  await expect(page.getByLabel('Название панели')).toHaveValue('Несохранённый черновик');
});
test('unconfigured connection makes no settings requests', async ({ page }) => {
  const calls = await fixture(page, 'unconfigured');
  await page.goto('/activity-control');
  await expect(page.getByText('Activity ещё не подключена')).toBeVisible();
  expect(calls.some((c) => c.path.includes('/activity-control/panels'))).toBe(false);
});

test('ambiguous creation reuses the original payload and command', async ({ page }) => {
  await fixture(page);
  const attempts: { key: string | undefined; binding?: string; body: unknown }[] = [];
  await page.route('**/activity-control/panels', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    attempts.push({
      key: route.request().headers()['idempotency-key'],
      body: route.request().postDataJSON(),
    });
    if (attempts.length === 1) return route.abort('failed');
    return route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { status: 503, message: 'Источник недоступен' } }),
    });
  });
  await page.goto('/activity-control');
  await page.getByRole('button', { name: 'Новая панель', exact: true }).click();
  await page.getByLabel('Название панели').fill('Повтор команды');
  await page.getByRole('checkbox', { name: 'Анна Тестовая Продажи' }).check();
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByLabel('Название панели')).toBeDisabled();
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByText('Источник недоступен')).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[1]).toEqual(attempts[0]);
});
test('distribution-only employee sees only allowed product links', async ({ page }) => {
  await fixture(page);
  await page.route('**/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id,
        firstName: 'Анна',
        lastName: 'Тестовая',
        email: 'test@example.invalid',
        role: 'employee',
        status: 'active',
        positionIds: [],
        departmentIds: [],
        sectionAccess: ['distribution'],
      }),
    }),
  );
  await page.goto('/distribution');
  const navigation = page.getByRole('navigation', { name: 'Продукты amoCRM' });
  await expect(navigation.getByRole('link', { name: 'Распределение сделок' })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Контроль активности' })).toHaveCount(0);
  await expect(navigation.getByRole('link', { name: 'Контроль задач' })).toHaveCount(0);
});

test('expired mutation offers the existing login route without replay', async ({ page }) => {
  await fixture(page);
  let writes = 0;
  await page.route(`**/activity-control/panels/${id}`, (route) => {
    writes++;
    return route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: { status: 401, message: 'Сессия истекла' } }),
    });
  });
  await page.goto('/activity-control');
  await page.getByRole('button', { name: 'Настроить', exact: true }).click();
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Войти снова' })).toHaveAttribute(
    'href',
    '/auth/login',
  );
  expect(writes).toBe(1);
});
