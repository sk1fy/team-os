import { rakursPost, type RakursContext } from './client';

export type AmoId = string | number;

export interface ActivityEmployee {
  id: AmoId;
  name: string;
  avatar?: string;
  groupId: AmoId | string;
  groupName: string;
  [key: string]: unknown;
}

export interface ActivityPipeline {
  value: AmoId;
  label: string;
  disabled?: boolean;
  [key: string]: unknown;
}

export interface ActivityOperator {
  employeeId: AmoId;
  enabled: boolean;
  plan: number;
  callDuration: number;
  talkDuration: number;
  overtime: number;
  [key: string]: unknown;
}

export interface ActivityPanel {
  id: string;
  panel_name: string;
  employees: AmoId[];
  pipelines: AmoId[];
  operators: ActivityOperator[];
  work_time_from: string;
  work_time_to: string;
  incoming_call_blocks: unknown[];
  outgoing_call_blocks: unknown[];
  correspondence_visible: boolean;
  correspondence_seconds: number;
  zoom_visible: boolean;
  tasks_visible: boolean;
  tasks_seconds: number;
  task_options: Record<string, unknown>;
  telegramBotEnabled: boolean;
  telegramToken: string;
  telegramChatId: string;
  telegramChatName: string;
  telegramUpdateInterval: number;
  telegramInactivityMinutes: number;
  activePanelLink?: string;
  [key: string]: unknown;
}

export interface ActivityTaskSettings {
  task_panel_enabled: boolean;
  enabled_employees: AmoId[];
  excluded_employees: AmoId[];
  consider_future_tasks: boolean;
  include_related_deals: boolean;
  [key: string]: unknown;
}

export interface ActivitySettings {
  panels: ActivityPanel[];
  tasks: ActivityTaskSettings;
  [key: string]: unknown;
}

export interface TelegramDiscoverResult {
  ok?: boolean;
  chat_id?: AmoId;
  chat_name?: string;
  message?: string;
  [key: string]: unknown;
}

export interface TelegramStatusResult {
  alive?: boolean;
  bot_username?: string;
  error_code?: 'no_token' | 'invalid_token' | 'network' | 'api_error' | string;
  [key: string]: unknown;
}

const ACTIVITY_BASE_URL =
  import.meta.env.VITE_RAKURS_ACTIVITY_API_URL ?? 'https://ssd.rkrs.ru/api/v1/rkrs_activity';

const DEFAULT_TASKS: ActivityTaskSettings = {
  task_panel_enabled: false,
  enabled_employees: [],
  excluded_employees: [],
  consider_future_tasks: false,
  include_related_deals: false,
};

const asObject = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const asNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeTime = (value: unknown, fallback: string) => {
  if (value === undefined || value === null || value === '') return fallback;
  const text = String(value);
  return text.includes(':') ? text : `${text}:00`;
};

export function normalizeActivityPanel(value: unknown): ActivityPanel {
  const source = asObject(value);
  const id = String(source.id ?? Date.now());
  const operators = asArray<Record<string, unknown>>(source.operators).map((operator) => ({
    ...operator,
    employeeId: (operator.employeeId ?? operator.employee_id ?? '') as AmoId,
    enabled: Boolean(operator.enabled ?? false),
    plan: asNumber(operator.plan, 100),
    callDuration: asNumber(operator.callDuration ?? operator.call_duration, 10),
    talkDuration: asNumber(operator.talkDuration ?? operator.talk_duration, 30),
    overtime: asNumber(operator.overtime, 180),
  }));

  return {
    ...source,
    id,
    panel_name: String(source.panel_name ?? source.panelName ?? 'Моя компания'),
    employees: asArray<AmoId>(source.employees),
    pipelines: asArray<AmoId>(source.pipelines),
    operators,
    work_time_from: normalizeTime(source.work_time_from ?? source.workTimeFrom, '09:00'),
    work_time_to: normalizeTime(source.work_time_to ?? source.workTimeTo, '21:00'),
    incoming_call_blocks: asArray(source.incoming_call_blocks ?? source.incomingCallBlocks),
    outgoing_call_blocks: asArray(source.outgoing_call_blocks ?? source.outgoingCallBlocks),
    correspondence_visible: Boolean(
      source.correspondence_visible ?? source.correspondenceVisible ?? true,
    ),
    correspondence_seconds: asNumber(
      source.correspondence_seconds ?? source.correspondenceSeconds,
      60,
    ),
    zoom_visible: Boolean(source.zoom_visible ?? false),
    tasks_visible: Boolean(source.tasks_visible ?? source.tasksVisible ?? false),
    tasks_seconds: asNumber(source.tasks_seconds ?? source.tasksSeconds, 120),
    task_options: asObject(source.task_options ?? source.taskOptions),
    telegramBotEnabled: Boolean(source.telegramBotEnabled ?? false),
    telegramToken: String(source.telegramToken ?? ''),
    telegramChatId: String(source.telegramChatId ?? ''),
    telegramChatName: String(source.telegramChatName ?? ''),
    telegramUpdateInterval: asNumber(source.telegramUpdateInterval, 10),
    telegramInactivityMinutes: asNumber(source.telegramInactivityMinutes, 20),
    activePanelLink:
      source.activePanelLink === undefined ? undefined : String(source.activePanelLink),
  };
}

export function normalizeActivitySettings(value: unknown): ActivitySettings {
  const envelope = asObject(value);
  const source = asObject(envelope.data ?? envelope.settings ?? value);
  const tasks = asObject(source.tasks);
  return {
    ...source,
    panels: asArray(source.panels).map(normalizeActivityPanel),
    tasks: {
      ...DEFAULT_TASKS,
      ...tasks,
      task_panel_enabled: Boolean(tasks.task_panel_enabled ?? false),
      enabled_employees: asArray<AmoId>(tasks.enabled_employees),
      excluded_employees: asArray<AmoId>(tasks.excluded_employees),
      consider_future_tasks: Boolean(tasks.consider_future_tasks ?? false),
      include_related_deals: Boolean(tasks.include_related_deals ?? false),
    },
  };
}

export function normalizeActivityEmployees(value: unknown): ActivityEmployee[] {
  const response = asObject(value);
  return asArray<Record<string, unknown>>(response.data ?? value).map((employee) => {
    const group = asObject(employee.group);
    return {
      ...employee,
      id: (employee.id ?? '') as AmoId,
      name: String(employee.name ?? `Сотрудник ${String(employee.id ?? '')}`),
      avatar: employee.avatar ? String(employee.avatar) : undefined,
      groupId: (group.id ?? employee.groupId ?? 'group_amo_crm') as AmoId | string,
      groupName: String(group.name ?? employee.groupName ?? 'Без отдела'),
    };
  });
}

export function normalizeActivityPipelines(value: unknown): ActivityPipeline[] {
  const response = asObject(value);
  return asArray<Record<string, unknown>>(response.data ?? value).map((pipeline) => ({
    ...pipeline,
    value: (pipeline.value ?? pipeline.id ?? '') as AmoId,
    label: String(pipeline.label ?? pipeline.name ?? pipeline.value ?? ''),
    disabled: Boolean(pipeline.disabled ?? false),
  }));
}

export function createActivityPanel(baseLink: string): ActivityPanel {
  const id = Date.now().toString();
  return {
    id,
    panel_name: 'Моя компания',
    employees: [],
    pipelines: [],
    operators: [],
    work_time_from: '09:00',
    work_time_to: '21:00',
    incoming_call_blocks: [],
    outgoing_call_blocks: [],
    correspondence_visible: true,
    correspondence_seconds: 60,
    zoom_visible: false,
    tasks_visible: false,
    tasks_seconds: 120,
    task_options: {},
    telegramBotEnabled: false,
    telegramToken: '',
    telegramChatId: '',
    telegramChatName: '',
    telegramUpdateInterval: 10,
    telegramInactivityMinutes: 20,
    activePanelLink: baseLink ? `${baseLink}?id=${id}` : undefined,
  };
}

export const activityApi = {
  async getSettings(context: RakursContext, signal?: AbortSignal): Promise<ActivitySettings> {
    const response = await rakursPost<unknown>(
      ACTIVITY_BASE_URL,
      'getSettings',
      context,
      undefined,
      signal,
    );
    return normalizeActivitySettings(response);
  },

  async updateSettings(
    context: RakursContext,
    settings: ActivitySettings,
    signal?: AbortSignal,
  ): Promise<ActivitySettings> {
    const response = await rakursPost<unknown>(
      ACTIVITY_BASE_URL,
      'setSettings',
      context,
      { settings },
      signal,
    );
    const result = asObject(response);
    if (result.data || result.settings) return normalizeActivitySettings(response);
    return settings;
  },

  async getEmployees(context: RakursContext, signal?: AbortSignal) {
    const response = await rakursPost<unknown>(
      ACTIVITY_BASE_URL,
      'getEmployee',
      context,
      undefined,
      signal,
    );
    return normalizeActivityEmployees(response);
  },

  async getPipelines(context: RakursContext, signal?: AbortSignal) {
    const response = await rakursPost<unknown>(
      ACTIVITY_BASE_URL,
      'getPipelines',
      context,
      undefined,
      signal,
    );
    return normalizeActivityPipelines(response);
  },

  async getLink(context: RakursContext, signal?: AbortSignal): Promise<string> {
    const response = await rakursPost<unknown>(
      ACTIVITY_BASE_URL,
      'getLink',
      context,
      undefined,
      signal,
    );
    return String(asObject(response).link ?? '');
  },

  discoverChatId(context: RakursContext, panelId: string, signal?: AbortSignal) {
    return rakursPost<TelegramDiscoverResult>(
      ACTIVITY_BASE_URL,
      'telegram/discover-chat-id',
      context,
      { panel_id: panelId },
      signal,
    );
  },

  getBotStatus(context: RakursContext, panelId: string, signal?: AbortSignal) {
    return rakursPost<TelegramStatusResult>(
      ACTIVITY_BASE_URL,
      'telegram/bot-status',
      context,
      { panel_id: panelId },
      signal,
    );
  },
};
