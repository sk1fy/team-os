/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const groupId = '00000000-0000-4000-8000-000000000001',
  ruleId = '00000000-0000-4000-8000-000000000002',
  bindingId = '00000000-0000-4000-8000-000000000003',
  queueId = '00000000-0000-4000-8000-000000000004',
  employeeId = '00000000-0000-4000-8000-000000000005';
async function fixture(
  page: Page,
  options: {
    role?: string;
    denied?: boolean;
    outage?: boolean;
    conflict?: boolean;
    actionTimeout?: boolean;
    accepted202?: boolean;
  } = {},
) {
  let state = 'waiting',
    revision = 1,
    groupRevision = 1,
    updated = '2026-10-03T08:00:00Z';
  let outage = !!options.outage;
  let conflictTriggered = false;
  let actionTimedOut = false;
  let workerPending = false;
  const calls: { path: string; method: string; body: any }[] = [];
  const user = {
    id: employeeId,
    firstName: 'Анна',
    lastName: 'Пескова',
    role: options.role ?? 'owner',
    status: 'active',
    email: 'test@example.invalid',
    sectionAccess: ['distribution', 'schedule'],
    departmentIds: [],
  };
  const group = () => ({
    id: groupId,
    name: 'Новые заявки',
    memberIds: [employeeId],
    disabledMemberIds: [],
    active: true,
    algorithm: 'round_robin',
    dealLimit: 10,
    revision: groupRevision,
  });
  const rule = () => ({
    id: ruleId,
    bindingId,
    bindingRevision: 1,
    groupId,
    accountId: '123',
    pipelineId: '10',
    statusId: '20',
    active: true,
    keepCurrentResponsible: true,
    revision,
    createdAt: updated,
    updatedAt: updated,
  });
  const item = () => ({
    id: queueId,
    entryId: queueId,
    groupId,
    ruleId,
    accountId: '123',
    leadId: options.denied ? null : '987',
    leadUrl: null,
    state,
    reason:
      state === 'waiting'
        ? 'no_available_members'
        : state === 'dispatching'
          ? 'operation_unfinished'
          : state === 'failed'
            ? 'recipient_unavailable'
            : state === 'confirmed'
              ? 'assignment_confirmed'
              : 'outcome_unknown',
    createdAt: '2026-10-03T07:00:00Z',
    updatedAt: updated,
    nextAttemptAt: '2026-10-03T10:00:00Z',
    plannedEmployeeId: employeeId,
    operationId: state === 'waiting' ? null : queueId,
    plannedAt: updated,
    resultVersion: state === 'confirmed' ? 1 : null,
    actions:
      state === 'confirmed'
        ? []
        : state === 'failed'
          ? ['retry']
          : state === 'waiting'
            ? ['recalculate', 'cancel']
            : ['check', 'cancel'],
  });
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    let body: any;
    try {
      body = req.postDataJSON();
    } catch {
      /* GET requests have no JSON body. */
    }
    calls.push({ path, method: req.method(), body });
    let data: any = {};
    let status = 200;
    if (path.endsWith('/auth/refresh')) data = { accessToken: 'fixture-only' };
    else if (path.endsWith('/auth/me')) data = user;
    else if (path.endsWith('/company')) data = { id: groupId, name: 'Тестовая компания' };
    else if (path.endsWith('/users')) data = [user];
    else if (path.endsWith('/distribution/groups')) {
      if (conflictTriggered) {
        status = 503;
        data = { error: { message: 'Источник недоступен', status: 503 } };
      } else data = [group()];
    } else if (path.endsWith('/configuration')) {
      if (options.conflict) {
        conflictTriggered = true;
        status = 409;
        data = { error: { message: 'Конфликт версии', status: 409 } };
      } else if (body.expectedRevision !== groupRevision || body.algorithm !== 'round_robin') {
        status = 400;
        data = { error: { message: 'Неверная конфигурация', status: 400 } };
      } else {
        groupRevision++;
        data = group();
      }
    } else if (path.endsWith('/distribution/rules')) data = { items: [rule()] };
    else if (path.endsWith(`/rules/${ruleId}`)) {
      if (body?.expectedRevision !== revision) {
        status = 409;
        data = { error: { message: 'Конфликт версии', status: 409 } };
      } else {
        revision++;
        data = rule();
      }
    } else if (path.endsWith('/distribution/connections'))
      data = [
        {
          bindingId,
          revision: 1,
          state: 'active',
          accountId: '123',
          mappingRevision: 1,
          mappingAckRevision: 1,
        },
      ];
    else if (path.endsWith('/distribution/references')) {
      if (outage) {
        status = 503;
        data = { error: { message: 'Источник amoCRM недоступен', status: 503 } };
      } else
        data = {
          pipelines: [
            { id: '10', name: 'Продажи', statuses: [{ id: '20', name: 'Новая заявка' }] },
          ],
          users: [{ id: '55', name: 'Анна', isActive: true }],
          freshUntil: '2099-01-01T00:00:00Z',
        };
    } else if (path.endsWith('/mappings'))
      data = [
        { userIdSnapshot: employeeId, userId: employeeId, crmUserId: '55', state: 'verified' },
      ];
    else if (path.endsWith('/settings')) data = { timezone: 'Europe/Moscow', revision: 1 };
    else if (path.endsWith('/availability'))
      data = {
        checkedAt: updated,
        employees: [
          {
            employeeId,
            crmUserId: '55',
            available: false,
            reason: 'off_shift',
            until: null,
            nextShift: '2026-10-03T10:00:00Z',
          },
        ],
      };
    else if (path.endsWith('/summary'))
      data = {
        timezone: 'Europe/Moscow',
        checkedAt: updated,
        metricsAvailable: !options.denied,
        waiting: options.denied ? null : state === 'waiting' ? 1 : 0,
        assigning: ['dispatching', 'uncertain'].includes(state) ? 1 : 0,
        errors: state === 'failed' ? 1 : 0,
        confirmedToday: state === 'confirmed' ? 1 : 0,
        keptToday: 0,
      };
    else if (path.endsWith('/distribution/queue')) {
      const tab = url.searchParams.get('tab');
      data = {
        items:
          (tab === 'waiting' && state === 'waiting') ||
          (tab === 'assigning' && ['dispatching', 'uncertain'].includes(state)) ||
          (tab === 'completed' && state === 'confirmed') ||
          (tab === 'errors' && state === 'failed')
            ? [item()]
            : [],
        hasMore: false,
        limit: 25,
        offset: 0,
      };
    } else if (path.endsWith('/history'))
      data = {
        items: [{ id: 1, state, reason: item().reason, createdAt: updated, payload: {} }],
        limit: 25,
        offset: 0,
        hasMore: false,
      };
    else if (path.endsWith('/actions')) {
      if (body.action === 'retry') state = 'waiting';
      updated = '2026-10-03T08:01:00Z';
      data = item();
      workerPending = true;
      status = options.accepted202 ? 202 : 200;
      if (options.actionTimeout && !actionTimedOut) {
        actionTimedOut = true;
        await route.abort();
        return;
      }
    } else if (path.endsWith(`/queue/${queueId}`)) {
      if (options.denied) {
        status = 403;
        data = { error: { message: 'Нет доступа к сделке', status: 403 } };
      } else {
        if (workerPending) {
          state = 'dispatching';
          workerPending = false;
        }
        data = item();
      }
    } else if (path.endsWith('/notifications')) data = [];
    else if (path.endsWith('/departments') || path.endsWith('/positions')) data = [];
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  });
  return {
    calls,
    setState: (next: string) => {
      workerPending = false;
      state = next;
      updated = new Date().toISOString();
    },
    setOutage: (value: boolean) => {
      outage = value;
    },
  };
}
for (const width of [1440, 390])
  test(`settings → waiting → assignment and error recovery ${width}`, async ({ page }) => {
    const f = await fixture(page);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`/distribution/${groupId}`);
    await page.getByRole('button', { name: 'Настройки', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Настройки распределения' })).toBeVisible();
    await expect(page.getByLabel('Оставлять сделку')).toBeChecked();
    await page.getByLabel('Название группы').fill('Новые заявки — проверено');
    await page.getByRole('button', { name: 'Сохранить настройки' }).click();
    await expect(page.getByText('Настройки сохранены', { exact: true })).toBeVisible();
    expect(f.calls.find((c) => c.path.endsWith('/configuration'))?.body.expectedRevision).toBe(1);
    expect(
      f.calls.find((c) => c.path.endsWith(`/rules/${ruleId}`))?.body.keepCurrentResponsible,
    ).toBe(true);
    await page.evaluate(() => {
      for (const node of document.querySelectorAll('*'))
        if (node instanceof HTMLElement && node.scrollTop > 0) node.scrollTop = 0;
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: `test-results/distribution-${width}-settings.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Очередь группы', exact: true }).click();
    await page.getByRole('button', { name: 'Сделка №987' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Пересчитать', exact: true }).click();
    await expect(
      page.getByRole('dialog').getByText('Назначается', { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByRole('dialog').getByText('Завершено', { exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
    const row = page.getByRole('button', { name: 'Сделка №987' });
    if (await row.count()) await expect(row).toBeFocused();
    else await expect(page.getByRole('tab', { name: 'Ожидают', exact: true })).toBeFocused();
    f.setState('failed');
    await page.getByRole('tab', { name: 'Ошибки', exact: true }).click();
    await expect(page.getByText('Ошибка', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Сделка №987' }).click();
    await page.getByRole('button', { name: 'Повторить после исправления', exact: true }).click();
    await expect(
      page.getByRole('dialog').getByText('Назначается', { exact: true }).first(),
    ).toBeVisible();
    f.setState('confirmed');
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: 'Завершены' }).click();
    await expect(page.getByText('Завершено', { exact: true })).toBeVisible();
    await page.evaluate(() => {
      for (const node of document.querySelectorAll('*'))
        if (node instanceof HTMLElement && node.scrollTop > 0) node.scrollTop = 0;
      window.scrollTo(0, 0);
    });
    if (width === 390) await page.setViewportSize({ width, height: 1600 });
    await page.screenshot({ path: `test-results/distribution-${width}-queue.png`, fullPage: true });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const result = await new AxeBuilder({ page }).include('main').analyze();
    expect(
      result.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious'),
    ).toEqual([]);
  });
test('CRM permission hides details and metrics', async ({ page }) => {
  await fixture(page, { denied: true });
  await page.goto('/distribution');
  await page.getByRole('button', { name: 'Сделка · подробности ограничены правами' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Нет прав');
  await expect(page.getByRole('button', { name: 'Проверить результат', exact: true })).toHaveCount(
    0,
  );
});
test('source outage preserves draft', async ({ page }) => {
  const f = await fixture(page, { outage: true });
  await page.goto(`/distribution/${groupId}`);
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.getByLabel('Название группы').fill('Мой черновик');
  await expect(page.getByText('Источник amoCRM недоступен')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Сохранить настройки' })).toBeDisabled();
  f.setOutage(false);
  await page.getByRole('button', { name: 'Повторить загрузку', exact: true }).click();
  await expect(page.getByLabel('Воронка')).toHaveValue('10');
  await expect(page.getByLabel('Название группы')).toHaveValue('Мой черновик');
});

test('409 and background 503 preserve edited fields', async ({ page }) => {
  await fixture(page, { conflict: true });
  await page.goto(`/distribution/${groupId}`);
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.getByLabel('Название группы').fill('Черновик после конфликта');
  await page.getByRole('button', { name: 'Сохранить настройки' }).click();
  await expect(page.getByText('Настройки изменились на сервере.', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Название группы')).toHaveValue('Черновик после конфликта');
  await expect(page.getByText('Источник недоступен', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Название группы')).toHaveValue('Черновик после конфликта');
});

test('202 receipt is not confirmed result', async ({ page }) => {
  await fixture(page, { accepted202: true });
  await page.goto('/distribution');
  await page.getByRole('button', { name: 'Сделка №987' }).click();
  await page.getByRole('button', { name: 'Пересчитать', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByText('Назначается', { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Завершено', { exact: true })).toHaveCount(0);
});

test('network retry reuses request id after detail close', async ({ page }) => {
  const f = await fixture(page, { actionTimeout: true });
  await page.goto('/distribution');
  await page.getByRole('button', { name: 'Сделка №987' }).click();
  await page.getByRole('button', { name: 'Пересчитать', exact: true }).click();
  await expect(page.getByText('Ответ на действие не получен.', { exact: false })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Назначаются', exact: true }).click();
  await page.getByRole('button', { name: 'Сделка №987' }).click();
  await expect(
    page.getByRole('button', { name: 'Проверить результат', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Восстановить результат действия' }).click();
  await expect(page.getByText('Запрос принят.', { exact: false })).toBeVisible();
  const calls = f.calls.filter((c) => c.path.endsWith('/actions'));
  expect(calls).toHaveLength(2);
  expect(calls[1].body).toEqual(calls[0].body);
});

test('pause remains available during CRM source outage', async ({ page }) => {
  const f = await fixture(page, { outage: true });
  await page.goto(`/distribution/${groupId}`);
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Сохранить настройки' })).toBeDisabled();
  await page.getByLabel('Распределение включено').uncheck();
  await page.getByRole('button', { name: 'Сохранить настройки' }).click();
  await expect(page.getByText('Настройки сохранены', { exact: true })).toBeVisible();
  expect(f.calls.find((c) => c.path.endsWith(`/rules/${ruleId}`))?.body.active).toBe(false);
});
