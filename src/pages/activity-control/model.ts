import { ApiError } from '@/api/client';
import type {
  ActivityDirectory,
  ActivityPanel,
  ActivityPanelInput,
  ActivityTaskPanel,
} from '@/api/activityControl';
import { plural } from '@/lib/format';

export type ActivityTab = 'dashboards' | 'task-panel' | 'connection';
export const ACTIVITY_TABS = ['dashboards', 'task-panel', 'connection'] as const;
export const ACTIVITY_PATH = '/activity-control';

export type Options = ActivityPanelInput['options'];
export type Operator = Options['operators'][number];
export type Thresholds = Operator['thresholds'];
export type Employee = ActivityDirectory['users'][number];

export const defaultThresholds = (): Thresholds => ({
  dialingSeconds: 10,
  conversationSeconds: 30,
  exceedingSeconds: 180,
});

export const emptyPanel = (): ActivityPanelInput => ({
  name: '',
  employeeIds: [],
  displayWindow: { from: '09:00', to: '18:00' },
  enabled: true,
  options: { pipelineIds: [], operators: [], departments: [] },
});

export function panelInput(panel: ActivityPanel): ActivityPanelInput {
  return {
    name: panel.name,
    employeeIds: panel.employeeIds,
    displayWindow: panel.displayWindow,
    enabled: panel.enabled,
    options: panel.options,
  };
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Не удалось выполнить запрос';
}

/**
 * Можно ли после ошибки править черновик. Ответ 4xx (кроме 429) — сервер
 * точно отклонил команду; сетевая ошибка, 5xx или 429 — результат не
 * подтверждён, повтор должен отправить ту же команду.
 */
export function isRejected(error: unknown) {
  return error instanceof ApiError && error.status < 500 && error.status !== 429;
}

export const isAccessError = (error: unknown) =>
  error instanceof ApiError && (error.status === 401 || error.status === 403);

export const employeesLabel = (count: number) =>
  `${count} ${plural(count, ['сотрудник', 'сотрудника', 'сотрудников'])}`;

export const departmentName = (name: string) => name.trim() || 'Без отдела';

export interface EmployeeGroup {
  id: number;
  name: string;
  users: Employee[];
}

/** Сотрудники справочника по отделам — в порядке справочника. */
export function groupEmployees(users: Employee[]): EmployeeGroup[] {
  const groups = new Map<number, EmployeeGroup>();
  for (const user of users) {
    const group = groups.get(user.groupId);
    if (group) group.users.push(user);
    else
      groups.set(user.groupId, {
        id: user.groupId,
        name: departmentName(user.groupName),
        users: [user],
      });
  }
  return [...groups.values()];
}

export function toggleEmployee(selected: number[], id: number, on: boolean) {
  if (on) return selected.includes(id) ? selected : [...selected, id];
  return selected.filter((item) => item !== id);
}

/** Переключатель отдела: если выбраны все — снимает всех, иначе добавляет недостающих. */
export function toggleGroup(selected: number[], ids: number[]) {
  const all = ids.length > 0 && ids.every((id) => selected.includes(id));
  if (all) return selected.filter((id) => !ids.includes(id));
  return [...selected, ...ids.filter((id) => !selected.includes(id))];
}

/** Состав панели: планы и пороги остаются только у выбранных сотрудников. */
export function withEmployees(
  draft: ActivityPanelInput,
  employeeIds: number[],
): ActivityPanelInput {
  return {
    ...draft,
    employeeIds,
    options: {
      ...draft.options,
      operators: draft.options.operators.filter((item) => employeeIds.includes(item.employeeId)),
    },
  };
}

/** Создаёт или меняет настройки сотрудника, сохраняя порядок остальных. */
export function setOperator(options: Options, employeeId: number, patch: Partial<Operator>) {
  const current = options.operators.find((item) => item.employeeId === employeeId);
  const next: Operator = current
    ? { ...current, ...patch }
    : { employeeId, enabled: false, plan: 100, thresholds: defaultThresholds(), ...patch };
  return {
    ...options,
    operators: current
      ? options.operators.map((item) => (item.employeeId === employeeId ? next : item))
      : [...options.operators, next],
  };
}

export function setDepartment(options: Options, groupId: number, thresholds: Thresholds | null) {
  const exists = options.departments.some((item) => item.groupId === groupId);
  if (!thresholds)
    return {
      ...options,
      departments: options.departments.filter((item) => item.groupId !== groupId),
    };
  return {
    ...options,
    departments: exists
      ? options.departments.map((item) =>
          item.groupId === groupId ? { ...item, thresholds } : item,
        )
      : [...options.departments, { groupId, thresholds }],
  };
}

/**
 * Отделы для порогов звонков: отделы выбранных сотрудников и отделы, у которых
 * уже есть собственные пороги (чтобы их можно было снять).
 */
export function thresholdGroups(directory: ActivityDirectory, draft: ActivityPanelInput) {
  const withRecords = new Set(draft.options.departments.map((item) => item.groupId));
  return groupEmployees(directory.users)
    .map((group) => ({
      ...group,
      selected: group.users.filter((user) => draft.employeeIds.includes(user.id)).length,
    }))
    .filter((group) => group.selected > 0 || withRecords.has(group.id));
}

const sortedIds = (ids: number[]) => [...ids].sort((a, b) => a - b);

function normalizePanel(input: ActivityPanelInput) {
  return {
    name: input.name,
    enabled: input.enabled,
    from: input.displayWindow.from,
    to: input.displayWindow.to,
    employeeIds: sortedIds(input.employeeIds),
    pipelineIds: sortedIds(input.options.pipelineIds),
    operators: [...input.options.operators]
      .sort((a, b) => a.employeeId - b.employeeId)
      .map((item) => [item.employeeId, item.enabled, item.plan, item.thresholds]),
    departments: [...input.options.departments]
      .sort((a, b) => a.groupId - b.groupId)
      .map((item) => [item.groupId, item.thresholds]),
  };
}

/** Совпадают ли настройки панели (порядок выбора не важен). */
export function samePanelInput(a: ActivityPanelInput, b: ActivityPanelInput) {
  return JSON.stringify(normalizePanel(a)) === JSON.stringify(normalizePanel(b));
}

/** Совпадают ли настройки панели задач: порядок приоритетов важен, порядок сотрудников — нет. */
export function sameTaskPanel(a: ActivityTaskPanel, b: ActivityTaskPanel) {
  return (
    a.enabled === b.enabled &&
    a.considerFutureTasks === b.considerFutureTasks &&
    a.includeRelatedDeals === b.includeRelatedDeals &&
    a.priorityKeys.join() === b.priorityKeys.join() &&
    sortedIds(a.employeeIds).join() === sortedIds(b.employeeIds).join()
  );
}

const PRIORITIES: Record<string, [string, string]> = {
  urgent: ['Срочные', 'Сегодня, задано время, дедлайн прошёл или наступит в ближайшие 10 минут'],
  overdue: ['Просроченные', 'Задача просрочена, у неё задано конкретное время'],
  overdue_no_time: ['Просроченные без времени', 'Задача просрочена, время выполнения не задано'],
  today_no_time: ['На сегодня без времени', 'Задача на сегодня на весь день'],
  today_timed: ['На сегодня со временем', 'Сегодняшняя задача, до которой больше 10 минут'],
  future: ['Будущие', 'Срок — завтра или позже'],
};

export function priorityInfo(key: string) {
  const [label, description] = PRIORITIES[key] ?? [key, ''];
  return { label, description };
}

/** Сдвигает приоритет на одну позицию; за границы списка не выходит. */
export function movePriority(keys: string[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (index < 0 || index >= keys.length || target < 0 || target >= keys.length) return keys;
  const next = [...keys];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
