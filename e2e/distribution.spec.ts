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
    actionReplayDenied?: boolean;
    groupPaused?: boolean;
    accepted202?: boolean;
    mode?: string;
    modeConflict?: boolean;
    observationOutage?: boolean;
    observationMalformed?: boolean;
    observationFuture?: boolean;
    night?: boolean;
  } = {},
) {
  let state = 'waiting',
    revision = 1,
    groupRevision = 1,
    updated = '2026-10-03T08:00:00Z';
  let outage = !!options.outage;
  let groupActive = !options.groupPaused;
  let mode = options.mode,
    executionEpoch = 1,
    liveStartedAt: string | null = mode === 'live' ? updated : null;
  let modeConflictTriggered = false;
  const liveWork = !options.mode || options.mode === 'live';
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
    active: groupActive,
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
    ...(mode ? { executionMode: mode, executionEpoch, liveStartedAt } : {}),
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
        groupActive = body.active;
        data = group();
      }
    } else if (path.endsWith('/distribution/rules')) data = { items: [rule()] };
    else if (path.endsWith(`/rules/${ruleId}/observations`)) {
      if (options.observationMalformed) {
        data = {};
      } else if (options.observationOutage) {
        status = 503;
        data = { error: { message: 'Источник наблюдений недоступен', status: 503 } };
      } else
        data = {
          items: [
            {
              id: '00000000-0000-4000-8000-000000000010',
              ruleId,
              groupId,
              entryId: queueId,
              eventId: queueId,
              executionEpoch: 1,
              ruleRevision: 1,
              availabilityRevision: 1,
              observationRevision: 1,
              checkedAt: updated,
              crmObservedAt: updated,
              bindingRevision: 1,
              sourceOccurredAt: updated,
              sourceReceivedAt: updated,
              decisionKind: options.observationFuture
                ? 'future_decision'
                : options.night
                  ? 'wait'
                  : 'assign',
              reason: options.night ? 'no_available_members' : 'decision_ready',
              leadId: '987',
              currentResponsibleUserId: '66',
              plannedEmployeeId: options.night ? null : employeeId,
              plannedResponsibleUserId: options.night ? null : '55',
              nextShiftAt: options.night ? '2026-10-03T10:00:00Z' : null,
            },
          ],
          limit: 25,
          offset: Number(url.searchParams.get('offset') || 0),
          hasMore: false,
          checkedAt: updated,
        };
    } else if (path.endsWith(`/rules/${ruleId}`)) {
      if (options.modeConflict && !modeConflictTriggered && body?.executionMode) {
        modeConflictTriggered = true;
        revision++;
        status = 409;
        data = { error: { message: 'Конфликт версии', status: 409 } };
      } else if (body?.expectedRevision !== revision) {
        status = 409;
        data = { error: { message: 'Конфликт версии', status: 409 } };
      } else {
        if (body?.executionMode && body.executionMode !== mode) {
          mode = body.executionMode;
          executionEpoch++;
          liveStartedAt = mode === 'live' ? new Date().toISOString() : null;
        }
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
          users: [
            { id: '55', name: 'Анна', isActive: true },
            { id: '66', name: 'Иван', isActive: true },
          ],
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
        waiting: options.denied ? null : liveWork && state === 'waiting' ? 1 : 0,
        assigning: ['dispatching', 'uncertain'].includes(state) ? 1 : 0,
        errors: state === 'failed' ? 1 : 0,
        confirmedToday: state === 'confirmed' ? 1 : 0,
        keptToday: 0,
      };
    else if (path.endsWith('/distribution/queue')) {
      const tab = url.searchParams.get('tab');
      data = {
        items:
          (liveWork && tab === 'waiting' && state === 'waiting') ||
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
      if (
        options.actionReplayDenied &&
        calls.filter((call) => call.path.endsWith('/actions')).length === 2
      ) {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            error: { message: 'Право на повтор временно отозвано', status: 403 },
          }),
        });
        return;
      }
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
    await expect(page.getByLabel('Режим правила')).toHaveValue('');
    await expect(page.getByLabel('Режим правила')).toBeDisabled();
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

test('observe records separate real owner and proposal; mode transition keeps history out of assignment queue', async ({
  page,
}) => {
  const f = await fixture(page, { mode: 'observe' });
  await page.goto(`/distribution/${groupId}`);
  const records = page.getByRole('region', { name: 'Журнал наблюдений' });
  await expect(page.getByRole('region', { name: 'Режим распределения' })).toContainText(
    'Наблюдение — без назначений',
  );
  await expect(records.getByText('Иван', { exact: true })).toBeVisible();
  await expect(records.getByText('Анна Пескова', { exact: true })).toBeVisible();
  await expect(records).toContainText('предварительное решение');
  await expect(page.getByRole('button', { name: 'Сделка №987' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.getByLabel('Режим правила').selectOption('live');
  await page.getByRole('button', { name: 'Сохранить настройки' }).click();
  await expect(page.getByText('Настройки сохранены', { exact: true })).toBeVisible();
  const write = f.calls.find((c) => c.path.endsWith(`/rules/${ruleId}`));
  expect(write?.body.executionMode).toBe('live');
  expect(write?.body.expectedRevision).toBe(1);
  await page.getByRole('button', { name: 'Очередь группы', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Режим распределения' })).toContainText(
    'Рабочий режим',
  );
  await expect(records.getByText('Иван', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Сделка №987' })).toHaveCount(0);
  expect(f.calls.filter((c) => c.path.endsWith('/actions'))).toHaveLength(0);
  await page.screenshot({
    path: '/Users/nikpeskov/.codex/state/clickup/rs10-artifacts/team-observe-1440.png',
    fullPage: true,
  });
});
test('night observe at390 shows wait and source failure is an error, never empty success', async ({
  page,
}) => {
  await fixture(page, { mode: 'observe', night: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/distribution/${groupId}`);
  const records = page.getByRole('region', { name: 'Журнал наблюдений' });
  await expect(records).toContainText('Предлагается ожидание');
  await expect(records).toContainText('Следующая смена');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: '/Users/nikpeskov/.codex/state/clickup/rs10-artifacts/team-observe-night-390.png',
    fullPage: true,
  });
  await page.route('**/rules/*/observations?*', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'Источник наблюдений недоступен', status: 503 } }),
    }),
  );
  await page.reload();
  await expect(records).toContainText('Источник наблюдений недоступен');
  await expect(records.getByText('В доступной области записей наблюдения пока нет.')).toHaveCount(
    0,
  );
});
test('409 keeps mode draft; unknown mode is disabled and never silently written as live', async ({
  page,
}) => {
  const f = await fixture(page, { mode: 'observe', modeConflict: true });
  await page.goto(`/distribution/${groupId}`);
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.getByLabel('Режим правила').selectOption('live');
  await page.getByRole('button', { name: 'Сохранить настройки' }).click();
  await expect(page.getByText('Настройки изменились на сервере.', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Режим правила')).toHaveValue('live');
  expect(f.calls.filter((c) => c.path.endsWith(`/rules/${ruleId}`))).toHaveLength(1);
  await fixture(page, { mode: 'future_mode' });
  await page.reload();
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await expect(page.getByLabel('Режим правила')).toBeDisabled();
  await expect(page.getByRole('region', { name: 'Режим распределения' })).toContainText(
    'Режим не подтверждён',
  );
});

test('malformed200 is a source error; future decisions stay unknown and refs failure cannot claim cached names', async ({
  page,
}) => {
  await fixture(page, { mode: 'observe', observationMalformed: true });
  await page.goto(`/distribution/${groupId}`);
  const records = page.getByRole('region', { name: 'Журнал наблюдений' });
  await expect(records).toContainText('неполные данные наблюдений');
  await expect(records).not.toContainText('В доступной области записей наблюдения пока нет.');
  await fixture(page, { mode: 'observe', observationFuture: true });
  await page.reload();
  await expect(records).toContainText('Тип решения неизвестен');
  await expect(records).not.toContainText('Наблюдение пропущено');
  await page.route('**/distribution/references?*', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'Справочник недоступен', status: 503 } }),
    }),
  );
  await page.reload();
  await expect(records).toContainText('Имена пользователей amoCRM не удалось проверить');
  await expect(records).toContainText('Имя ответственного недоступно');
  await expect(records.getByText('Иван', { exact: true })).toHaveCount(0);
  await expect(records).toContainText('Тип решения неизвестен');
});

test('denied replay keeps original unknown action and blocks replacement request', async ({
  page,
}) => {
  const f = await fixture(page, { actionTimeout: true, actionReplayDenied: true });
  await page.goto('/distribution');
  await page.getByRole('button', { name: 'Сделка №987' }).click();
  await page.getByRole('button', { name: 'Пересчитать', exact: true }).click();
  await expect(page.getByText('Ответ на действие не получен.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Восстановить результат действия' }).click();
  await expect.poll(() => f.calls.filter((c) => c.path.endsWith('/actions')).length).toBe(2);
  await expect(page.getByRole('button', { name: 'Восстановить результат действия' })).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Проверить результат', exact: true }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Открыть группу' }).click();
  await expect(page.getByRole('link', { name: '← Все группы' })).toBeVisible();
  await page.getByRole('tab', { name: 'Назначаются', exact: true }).click();
  await page.getByRole('button', { name: 'Сделка №987' }).click();
  await expect(
    page.getByRole('button', { name: 'Проверить результат', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Восстановить результат действия' }).click();
  await expect(page.getByText('Запрос принят.', { exact: false })).toBeVisible();
  const requests = f.calls.filter((c) => c.path.endsWith('/actions'));
  expect(requests).toHaveLength(3);
  expect(requests[1].body).toEqual(requests[0].body);
  expect(requests[2].body).toEqual(requests[0].body);
});

for (const screen of ['list', 'settings']) {
  test(`revoked group access hides cached ${screen} content`, async ({ page }) => {
    await fixture(page);
    await page.goto(screen === 'settings' ? `/distribution/${groupId}` : '/distribution');
    if (screen === 'settings') {
      await page.getByRole('button', { name: 'Настройки', exact: true }).click();
      await page.getByLabel('Название группы').fill('Закрытый черновик');
    }
    await expect(page.getByRole('heading', { name: 'Новые заявки', exact: true })).toBeVisible();
    await page.route('**/api/v1/distribution/groups', (route) =>
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Нет прав', status: 403 } }),
      }),
    );
    // Wait for the bounded background poll to detect revoked access.
    await expect(
      page.getByText('Нет прав для работы с распределением.', { exact: false }),
    ).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('heading', { name: 'Новые заявки', exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Название группы')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Сделка №987' })).toHaveCount(0);
  });
}

for (const conflict of [false, true]) {
  test(`switch from paused live to observe enables group only after saving rule (conflict=${conflict})`, async ({
    page,
  }) => {
    const f = await fixture(page, { mode: 'live', groupPaused: true, modeConflict: conflict });
    await page.goto(`/distribution/${groupId}`);
    await page.getByRole('button', { name: 'Настройки', exact: true }).click();
    await expect(page.getByLabel('Распределение включено')).not.toBeChecked();
    await page.getByLabel('Режим правила').selectOption('observe');
    await page.getByLabel('Распределение включено').check();
    await page.getByRole('button', { name: 'Сохранить настройки' }).click();
    if (conflict)
      await expect(
        page.getByText('Настройки изменились на сервере.', { exact: false }),
      ).toBeVisible();
    else await expect(page.getByText('Настройки сохранены', { exact: true })).toBeVisible();
    const writes = f.calls.filter((c) => c.method === 'PUT');
    expect(writes.map((c) => c.path)).toEqual([
      `/api/v1/distribution/groups/${groupId}/configuration`,
      `/api/v1/distribution/rules/${ruleId}`,
      ...(conflict ? [] : [`/api/v1/distribution/groups/${groupId}/configuration`]),
    ]);
    expect(writes[0].body.active).toBe(false);
    expect(writes[1].body.executionMode).toBe('observe');
    if (!conflict) {
      expect(writes[2].body.active).toBe(true);
      expect(writes[2].body.expectedRevision).toBe(2);
    }
  });
}
