/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
const reviewPath = (info: TestInfo, name: string) =>
  join(process.env.DISTRIBUTION_UI_REVIEW_DIR ?? info.outputPath('ui-review'), name);
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
    source?: 'creation' | 'digital_pipeline' | 'legacy_stage';
    timezoneStatus?: 'confirmed' | 'cached' | 'unavailable';
    timezone?: string;
    moreUsers?: boolean;
    longParticipantName?: boolean;
    groupName?: string;
  } = {},
) {
  let state = 'waiting',
    revision = 1,
    groupRevision = 1,
    updated = '2026-10-07T10:00:00Z';
  let source = options.source ?? 'creation';
  let pipeline = source === 'digital_pipeline' ? '' : '10';
  let stage = source === 'legacy_stage' ? '20' : '';
  let members = [employeeId];
  let disabledMembers: string[] = [];
  let groupName = options.groupName ?? 'Новые заявки';
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
    lastName: options.longParticipantName ? 'Александрова-Константинопольская' : 'Пескова',
    role: options.role ?? 'owner',
    status: 'active',
    email: 'test@example.invalid',
    sectionAccess: ['distribution', 'schedule'],
    departmentIds: [],
  };
  const group = () => ({
    id: groupId,
    name: groupName,
    memberIds: members,
    disabledMemberIds: disabledMembers,
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
    source,
    pipelineId: pipeline,
    statusId: stage,
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
    leadUrl: options.denied ? null : 'https://fixture.amocrm.ru/leads/detail/987',
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
              : state === 'cancelled'
                ? 'waiting_expired'
                : 'outcome_unknown',
    createdAt: '2026-10-07T09:00:00Z',
    updatedAt: updated,
    nextAttemptAt: '2026-10-08T06:00:00Z',
    nextShiftAt: '2026-10-08T06:00:00Z',
    waitingDeadlineAt: '2026-10-10T09:00:00Z',
    currentEmployeeId: state === 'confirmed' ? employeeId : null,
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
    else if (path.endsWith('/users'))
      data = options.moreUsers
        ? [
            user,
            {
              ...user,
              id: '00000000-0000-4000-8000-000000000006',
              firstName: 'Борис',
              lastName: 'Иванов',
            },
          ]
        : [user];
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
        members = body.memberIds;
        disabledMembers = body.disabledMemberIds;
        groupName = body.name;
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
        source = body.source ?? source;
        pipeline = body.pipelineId ?? pipeline;
        stage = body.statusId ?? stage;
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
        ...(options.moreUsers
          ? [
              {
                userIdSnapshot: '00000000-0000-4000-8000-000000000006',
                crmUserId: '66',
                state: 'verified',
              },
            ]
          : []),
      ];
    else if (path.endsWith('/settings'))
      data = {
        timezone: options.timezone ?? 'Europe/Moscow',
        timezoneSource: 'amocrm',
        timezoneStatus: options.timezoneStatus ?? 'confirmed',
        revision: 1,
      };
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
            nextShift: '2026-10-08T06:00:00Z',
          },
        ],
      };
    else if (path.endsWith('/summary'))
      data = {
        timezone: options.timezone ?? 'Europe/Moscow',
        checkedAt: updated,
        metricsAvailable: !options.denied,
        waiting: options.denied
          ? null
          : liveWork && ['waiting', 'dispatching', 'uncertain'].includes(state)
            ? 1
            : 0,
        assigning: ['dispatching', 'uncertain'].includes(state) ? 1 : 0,
        errors: state === 'failed' ? 1 : 0,
        confirmedToday: state === 'confirmed' ? 1 : 0,
        keptToday: 0,
      };
    else if (path.endsWith('/distribution/queue')) {
      const tab = url.searchParams.get('tab');
      data = {
        items:
          (liveWork &&
            tab === 'waiting' &&
            ['waiting', 'dispatching', 'uncertain'].includes(state)) ||
          (tab === 'completed' && state === 'confirmed') ||
          (tab === 'errors' && state === 'failed') ||
          (tab === 'cancelled' && state === 'cancelled')
            ? [item()]
            : [],
        hasMore: false,
        limit: 15,
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
      updated = '2026-10-07T10:01:00Z';
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
      page.getByRole('dialog').getByText('Ожидает', { exact: true }).first(),
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
      page.getByRole('dialog').getByText('Ожидает', { exact: true }).first(),
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
    page.getByRole('dialog').getByText('Ожидает', { exact: true }).first(),
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
  await page.getByRole('tab', { name: 'Ожидают', exact: true }).click();
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
  await page.getByRole('switch', { name: 'Распределение включено', exact: true }).click();
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
    path: 'test-results/team-observe-1440.png',
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
    path: 'test-results/team-observe-night-390.png',
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
  await page.getByRole('tab', { name: 'Ожидают', exact: true }).click();
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
    await page.getByRole('switch', { name: 'Распределение включено', exact: true }).click();
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

for (const count of [0, 1, 15, 16, 31]) {
  test(`queue pages cover ${count} entries with server limit 15`, async ({ page }) => {
    await fixture(page, { mode: 'live' });
    const requests: { offset: number; limit: number; tab: string | null }[] = [];
    await page.route('**/api/v1/distribution/queue?*', async (route) => {
      const url = new URL(route.request().url());
      const offset = Number(url.searchParams.get('offset'));
      const limit = Number(url.searchParams.get('limit'));
      requests.push({ offset, limit, tab: url.searchParams.get('tab') });
      const all = Array.from({ length: count }, (_, index) => ({
        id: `page-${index}`,
        leadId: String(1000 + index),
        groupId,
        createdAt: '2026-10-07T10:00:00Z',
        updatedAt: '2026-10-07T10:00:00Z',
        state: 'waiting',
        reason: 'no_available_members',
        nextShiftAt: null,
        waitingDeadlineAt: '2026-10-10T10:00:00Z',
        plannedEmployeeId: null,
      }));
      await route.fulfill({
        json: {
          items: all.slice(offset, offset + limit),
          offset,
          limit,
          hasMore: offset + limit < all.length,
        },
      });
    });
    await page.goto(`/distribution/${groupId}`);
    const panel = page.getByRole('tabpanel');
    await expect(panel.getByRole('article')).toHaveCount(Math.min(15, count));
    const seen: string[] = [];
    for (let offset = 0; offset < Math.max(1, count); offset += 15) {
      const expected = Array.from(
        { length: Math.min(15, count - offset) },
        (_, index) => `Сделка №${1000 + offset + index}`,
      );
      await expect(panel.getByRole('button')).toHaveText(expected);
      seen.push(...(await panel.getByRole('button').allTextContents()));
      if (offset + 15 < count)
        await page.getByRole('button', { name: 'Далее', exact: true }).click();
    }
    expect(new Set(seen).size).toBe(count);
    await expect(page.getByRole('button', { name: 'Далее', exact: true })).toBeDisabled();
    expect(requests.every((request) => request.limit === 15)).toBe(true);
    expect([...new Set(requests.map((request) => request.offset))]).toEqual(
      Array.from({ length: Math.max(1, Math.ceil(count / 15)) }, (_, pageIndex) => pageIndex * 15),
    );
    if (count > 15) {
      await page.getByRole('tab', { name: 'Завершены', exact: true }).click();
      await expect(panel.getByRole('article')).toHaveCount(15);
      await expect(page.getByText('Страница 1 · 1–15', { exact: true })).toBeVisible();
      expect(requests.at(-1)).toEqual({ offset: 0, limit: 15, tab: 'completed' });
      await page.getByLabel('С события').fill('2026-10-07T00:15');
      await expect(page.getByText('Страница 1 · 1–15', { exact: true })).toBeVisible();
    }
  });
}

test('automatic refresh keeps page; a vanished last entry returns to the previous page', async ({
  page,
}) => {
  test.setTimeout(50000);
  await fixture(page, { mode: 'live' });
  let count = 31;
  let refreshes = 0;
  await page.route('**/api/v1/distribution/queue?*', (route) => {
    const url = new URL(route.request().url());
    const offset = Number(url.searchParams.get('offset'));
    refreshes++;
    return route.fulfill({
      json: {
        items: Array.from({ length: Math.max(0, Math.min(15, count - offset)) }, (_, index) => ({
          id: `entry-${offset + index}`,
          leadId: `${1000 + offset + index}`,
          groupId,
          state: 'waiting',
          reason: 'waiting_for_shift',
          createdAt: '2026-10-07T10:00:00Z',
          updatedAt: '2026-10-07T10:00:00Z',
        })),
        limit: 15,
        offset,
        hasMore: offset + 15 < count,
      },
    });
  });
  await page.goto(`/distribution/${groupId}`);
  await expect(page.getByRole('tabpanel').getByRole('article')).toHaveCount(15);
  await page.getByRole('button', { name: 'Далее', exact: true }).click();
  await expect(page.getByText('Страница 2 · 16–30', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Далее', exact: true }).click();
  await expect(page.getByText('Страница 3 · 31–31', { exact: true })).toBeVisible();
  const before = refreshes;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect.poll(() => refreshes, { timeout: 20000 }).toBeGreaterThan(before);
  await expect(page.getByText('Страница 3 · 31–31', { exact: true })).toBeVisible();
  count = 30;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByText('Страница 2 · 16–30', { exact: true })).toBeVisible({
    timeout: 20000,
  });
});

test('launch types clear hidden restrictions and reload from server; employees support keyboard and round robin order', async ({
  page,
}) => {
  const f = await fixture(page, { mode: 'live', source: 'legacy_stage', moreUsers: true });
  await page.goto(`/distribution/${groupId}`);
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await expect(page.getByLabel('Подключение amoCRM')).toHaveCount(0);
  await expect(page.getByLabel('Часовой пояс компании')).toHaveCount(0);
  await page.getByRole('radio', { name: 'По триггеру на этапе', exact: true }).check();
  await expect(page.getByLabel('Воронка')).toHaveCount(0);
  await expect(page.getByLabel('Этап', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Сохранить настройки' }).click();
  await expect(page.getByText('Настройки сохранены', { exact: true })).toBeVisible();
  const digital = f.calls.filter((call) => call.path.endsWith(`/rules/${ruleId}`)).at(-1)?.body;
  expect(digital).toMatchObject({ source: 'digital_pipeline', pipelineId: '', statusId: '' });
  await page.reload();
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await expect(
    page.getByRole('radio', { name: 'По триггеру на этапе', exact: true }),
  ).toBeChecked();
  await expect(page.getByLabel('Воронка')).toHaveCount(0);
  await page
    .getByRole('radio', { name: 'При создании сделки в выбранной воронке', exact: true })
    .check();
  await page.getByLabel('Воронка').selectOption('10');
  await expect(page.getByLabel('Этап', { exact: true })).toHaveCount(0);
  const picker = page.getByRole('combobox', { name: 'Добавить сотрудника', exact: true });
  await picker.fill('Неизвестный');
  await expect(page.getByText('Сотрудники не найдены', { exact: true })).toBeVisible();
  await picker.fill('бор');
  await expect(page.getByRole('option', { name: 'Борис Иванов', exact: true })).toBeVisible();
  await picker.press('ArrowDown');
  await picker.press('Enter');
  await expect(
    page.getByRole('switch', { name: 'Участие Борис Иванов', exact: true }),
  ).toBeChecked();
  await page.getByRole('button', { name: 'Поднять Борис Иванов', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Поднять Борис Иванов', exact: true }),
  ).toBeDisabled();
  await page.getByRole('switch', { name: 'Участие Анна Пескова', exact: true }).click();
  await page.getByRole('button', { name: 'Сохранить настройки' }).click();
  await expect(page.getByText('Настройки сохранены', { exact: true })).toBeVisible();
  const creation = f.calls.filter((call) => call.path.endsWith(`/rules/${ruleId}`)).at(-1)?.body;
  expect(creation).toMatchObject({ source: 'creation', pipelineId: '10', statusId: '' });
  expect(
    f.calls.filter((call) => call.path.endsWith('/settings') && call.method === 'PUT'),
  ).toHaveLength(0);
  const configuration = f.calls.filter((call) => call.path.endsWith('/configuration')).at(-1)?.body;
  expect(configuration.memberIds).toEqual(['00000000-0000-4000-8000-000000000006', employeeId]);
  expect(configuration.disabledMemberIds).toEqual([employeeId]);
  await page.reload();
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await expect(
    page.getByRole('radio', { name: 'При создании сделки в выбранной воронке', exact: true }),
  ).toBeChecked();
  await expect(page.getByLabel('Воронка')).toHaveValue('10');
  await picker.click();
  await expect(page.getByText('Все доступные сотрудники уже добавлены')).toBeVisible();
});

test('unverified account timezone is explained and cannot silently activate; a paused group can still be saved', async ({
  page,
}) => {
  const f = await fixture(page, { mode: 'live', timezoneStatus: 'unavailable' });
  await page.goto(`/distribution/${groupId}`);
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await expect(
    page.getByText('Часовой пояс аккаунта amoCRM пока не подтверждён.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Сохранить настройки' }).click();
  await expect(
    page.getByText('Часовой пояс аккаунта amoCRM не подтверждён.', { exact: false }),
  ).toBeVisible();
  expect(f.calls.filter((call) => call.method === 'PUT')).toHaveLength(0);
  await page.getByRole('switch', { name: 'Распределение включено', exact: true }).click();
  await page.getByRole('button', { name: 'Сохранить настройки' }).click();
  await expect(page.getByText('Настройки сохранены', { exact: true })).toBeVisible();
});

for (const width of [1280, 390]) {
  test(`review queue history settings and header ${width}`, async ({ page }, testInfo) => {
    await fixture(page, {
      mode: 'live',
      moreUsers: true,
      groupName: 'Распределение новых обращений отдела продаж и сопровождения клиентов',
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/distribution/${groupId}`);
    await expect(page.getByRole('article', { name: 'Сделка №987' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Назначаются', exact: true })).toHaveCount(0);
    await expect(page.getByRole('article')).toContainText('сейчас никто не работает по графику');
    await expect(page.getByRole('article')).toContainText('максимум 3 дня');
    if (width === 390) {
      const title = await page.getByRole('heading', { level: 1 }).boundingBox();
      const navigation = await page
        .getByRole('button', { name: 'Очередь группы', exact: true })
        .boundingBox();
      expect(title!.width).toBeGreaterThan(width - 80);
      expect(navigation!.y).toBeGreaterThanOrEqual(title!.y + title!.height);
    }
    await page.setViewportSize({ width, height: width === 390 ? 2500 : 1800 });
    await page.screenshot({
      path: reviewPath(testInfo, `queue-waiting-${width}.png`),
      fullPage: true,
      animations: 'disabled',
    });
    const modeBox = await page.getByRole('region', { name: 'Режим распределения' }).boundingBox();
    const backBox = await page
      .getByRole('link', { name: '← Все группы', exact: true })
      .boundingBox();
    await page.screenshot({
      path: reviewPath(testInfo, `header-${width}.png`),
      clip: {
        x: modeBox!.x,
        y: backBox!.y,
        width: modeBox!.width,
        height: modeBox!.y + modeBox!.height - backBox!.y,
      },
      animations: 'disabled',
    });
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: 'Сделка №987' }).click();
    await expect(
      page.getByRole('dialog').getByRole('heading', { name: 'История · Сделка №987' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Предыдущие события' })).toHaveCount(0);
    await expect(
      page.getByRole('dialog').getByText('Предыдущий ответственный не зафиксирован.'),
    ).toBeVisible();
    await assertModalInViewport(page);
    await page.screenshot({
      path: reviewPath(testInfo, `history-${width}.png`),
      fullPage: true,
      animations: 'disabled',
    });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Сделка №987' })).toBeFocused();
    await page.getByRole('button', { name: 'Настройки', exact: true }).click();
    await page.getByRole('radio', { name: 'По триггеру на этапе', exact: true }).check();
    await expect(page.getByLabel('Воронка')).toHaveCount(0);
    await page.getByRole('combobox', { name: 'Добавить сотрудника', exact: true }).fill('Борис');
    await page.setViewportSize({ width, height: width === 390 ? 2200 : 1500 });
    await page.evaluate(() => {
      for (const element of document.querySelectorAll('*'))
        if (element instanceof HTMLElement && element.scrollTop) element.scrollTop = 0;
    });
    await expect(page.getByRole('button', { name: 'Настройки', exact: true })).toBeEnabled();
    await page.screenshot({
      path: reviewPath(testInfo, `settings-${width}.png`),
      fullPage: true,
      animations: 'disabled',
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const result = await new AxeBuilder({ page }).include('main').analyze();
    expect(
      result.violations.filter((violation) =>
        ['serious', 'critical'].includes(violation.impact ?? ''),
      ),
    ).toEqual([]);
  });
}

async function assertModalInViewport(page: Page) {
  const dialog = page.getByRole('dialog');
  // Exercise the actual CSS entrance animation, including its middle frame.
  // Tailwind's translate utilities must not be repeated by the keyframe.
  await dialog.evaluate((element) => {
    element.style.animation = 'none';
    void element.offsetWidth;
    element.style.animation = '';
    for (const animation of element.getAnimations()) {
      animation.pause();
      animation.currentTime = 50;
    }
  });
  for (const position of ['during', 'after']) {
    const box = await dialog.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
    await expect(dialog.getByRole('button', { name: 'Закрыть', exact: true })).toBeInViewport();
    if (position === 'during')
      await dialog.evaluate((element) => {
        for (const animation of element.getAnimations()) animation.finish();
      });
  }
}

test('expiry cancellation keeps final outcome and long paged history inside the viewport', async ({
  page,
}, testInfo) => {
  const f = await fixture(page, { mode: 'live' });
  f.setState('cancelled');
  await page.setViewportSize({ width: 390, height: 700 });
  await page.route('**/api/v1/distribution/queue/*/history?*', (route) => {
    const url = new URL(route.request().url());
    const offset = Number(url.searchParams.get('offset'));
    const all = Array.from({ length: 31 }, (_, index) => ({
      id: index + 1,
      state: index === 30 ? 'cancelled' : 'waiting',
      reason: index === 30 ? 'waiting_expired' : 'no_available_members',
      createdAt: '2026-10-07T10:00:00Z',
      payload: {},
    }));
    return route.fulfill({
      json: {
        items: all.slice(offset, offset + 25),
        limit: 25,
        offset,
        hasMore: offset + 25 < all.length,
      },
    });
  });
  await page.goto(`/distribution/${groupId}`);
  await page.getByRole('tab', { name: 'Отменены', exact: true }).click();
  const row = page.getByRole('article', { name: 'Сделка №987' });
  await expect(row).toContainText('Истёк срок ожидания — 3 дня');
  await expect(row).not.toContainText('Следующая смена');
  await expect(row).not.toContainText('Следующая проверка');
  await page.getByRole('button', { name: 'Сделка №987', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('listitem')).toHaveCount(25);
  await assertModalInViewport(page);
  await expect(dialog.getByRole('button', { name: 'Предыдущие события' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Следующие события' }).click();
  await expect(dialog.getByRole('listitem')).toHaveCount(6);
  await expect(dialog.getByRole('button', { name: 'Следующие события' })).toBeDisabled();
  await expect(dialog.getByText('Истёк срок ожидания — 3 дня', { exact: true })).toHaveCount(2);
  await dialog.getByRole('button', { name: 'Предыдущие события' }).click();
  await expect(dialog.getByRole('listitem')).toHaveCount(25);
  await expect(dialog.getByRole('button', { name: 'Закрыть', exact: true })).toBeInViewport();
  await page.keyboard.press('Tab');
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.screenshot({
    path: reviewPath(testInfo, 'history-long-390.png'),
    animations: 'disabled',
  });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Сделка №987' })).toBeFocused();
});

test('confirmed recipient stays distinct from a later manual CRM owner; long names fit on mobile', async ({
  page,
}) => {
  const f = await fixture(page, { mode: 'live', moreUsers: true, longParticipantName: true });
  f.setState('confirmed');
  await page.setViewportSize({ width: 390, height: 800 });
  await page.route(`**/api/v1/distribution/queue/${queueId}`, (route) =>
    route.fulfill({
      json: {
        id: queueId,
        leadId: '987',
        leadName: 'Входящий запрос на консультацию и подключение отдела продаж',
        groupId,
        state: 'confirmed',
        reason: 'assignment_confirmed',
        createdAt: '2026-10-07T09:00:00Z',
        updatedAt: '2026-10-07T10:00:00Z',
        plannedEmployeeId: employeeId,
        currentEmployeeId: '00000000-0000-4000-8000-000000000006',
        previousEmployeeId: null,
        operationId: queueId,
        resultVersion: 1,
        actions: [],
      },
    }),
  );
  await page.goto(`/distribution/${groupId}`);
  await page.getByRole('tab', { name: 'Завершены', exact: true }).click();
  await page.getByRole('button', { name: 'Сделка №987', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByText('Подтверждённый ответственный', { exact: true }).locator('..'),
  ).toContainText('Анна Александрова-Константинопольская');
  await expect(dialog.getByText('Сейчас в amoCRM', { exact: true }).locator('..')).toContainText(
    'Борис',
  );
  await expect(dialog.getByRole('heading', { level: 2 })).toContainText('№987');
  await assertModalInViewport(page);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await expect(
    page.getByRole('switch', {
      name: 'Участие Анна Александрова-Константинопольская',
      exact: true,
    }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
