import type { TaskControlRule } from '@/api/taskControl';
import { plural } from '@/lib/format';

// Decoding is only for form routing. Core signature and authorization are verified by backend.
export function readProof(raw: string, purpose: 'link' | 'mode', accountId: string) {
  try {
    const parts = raw.trim().split('.');
    if (parts.length !== 3 || raw.length > 8192) throw new Error();
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const proof = JSON.parse(atob(payload));
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (
      proof.purpose !== purpose ||
      proof.accountId !== accountId ||
      proof.product !== 'task-control' ||
      proof.aud !== 'teamos-task-control' ||
      !uuid.test(proof.requestId) ||
      !uuid.test(proof.installationId) ||
      !uuid.test(proof.integrationId) ||
      !Number.isFinite(proof.exp) ||
      proof.exp * 1000 <= Date.now()
    )
      throw new Error();
    return proof as { requestId: string; installationId: string; integrationId: string };
  } catch {
    throw new Error(
      'Код истёк, относится к другому аккаунту или действию. Получите новый код в настройках виджета.',
    );
  }
}
export function crmIds(value: string): string[] {
  const ids = value.trim() ? value.trim().split(/[\s,;]+/) : [];
  if (ids.some((id) => !/^[1-9][0-9]*$/.test(id) || !Number.isSafeInteger(Number(id)))) {
    throw new Error('ID amoCRM должны быть положительными целыми числами.');
  }
  return [...new Set(ids)];
}
export function newRule(): TaskControlRule {
  return {
    ruleUid: crypto.randomUUID(),
    name: 'Новое правило',
    users: [],
    pipelines: [],
    customers: false,
    customerStatuses: [],
    showModal: true,
    denyExit: false,
    checkResponsible: true,
    enabled: true,
    archived: false,
  };
}

/* ---------- справочники amoCRM: только для подписей и выбора в редакторе ---------- */

export interface CrmNamed {
  id: string;
  name: string;
}
export interface CrmUser extends CrmNamed {
  active: boolean;
}
export interface CrmPipeline extends CrmNamed {
  statuses: CrmNamed[];
}
export interface CrmReferences {
  users: CrmUser[];
  pipelines: CrmPipeline[];
  customersSupported: boolean;
  customerStatuses: CrmNamed[];
}

const isNamed = (value: unknown): value is CrmNamed =>
  !!value &&
  typeof (value as CrmNamed).id === 'string' &&
  typeof (value as CrmNamed).name === 'string';

/**
 * Справочник из GET /references. Без полного ответа редактор остаётся на ручном
 * вводе ID — как и раньше. Проверку ID при сохранении по-прежнему делает backend.
 */
export function readReferences(value: unknown): CrmReferences | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.users) || !Array.isArray(raw.pipelines)) return undefined;
  const byName = (a: CrmNamed, b: CrmNamed) => a.name.localeCompare(b.name, 'ru');
  return {
    users: raw.users
      .filter(isNamed)
      .map((user) => ({ id: user.id, name: user.name, active: (user as CrmUser).active !== false }))
      .sort(byName),
    pipelines: raw.pipelines.filter(isNamed).map((pipeline) => ({
      id: pipeline.id,
      name: pipeline.name,
      statuses: Array.isArray((pipeline as CrmPipeline).statuses)
        ? (pipeline as CrmPipeline).statuses.filter(isNamed)
        : [],
    })),
    customersSupported: raw.customersSupported === true,
    customerStatuses: Array.isArray(raw.customerStatuses)
      ? raw.customerStatuses.filter(isNamed)
      : [],
  };
}

/** Системные этапы amoCRM «Успешно реализовано» и «Закрыто и не реализовано». */
export const CLOSED_STATUS_IDS: ReadonlySet<string> = new Set(['142', '143']);
export const openStatuses = (pipeline: CrmPipeline) =>
  pipeline.statuses.filter((status) => !CLOSED_STATUS_IDS.has(status.id));

export type PipelineState = 'none' | 'some' | 'all';
/** Отмечена ли воронка целиком: все её открытые этапы выбраны явно. */
export function pipelineState(
  statusIds: string[] | undefined,
  pipeline: CrmPipeline,
): PipelineState {
  if (!statusIds) return 'none';
  const open = openStatuses(pipeline);
  return open.length > 0 && open.every((status) => statusIds.includes(status.id)) ? 'all' : 'some';
}

export const stageWord = (n: number) => `${n} ${plural(n, ['этап', 'этапа', 'этапов'])}`;
export const userWord = (n: number) =>
  `${n} ${plural(n, ['пользователь', 'пользователя', 'пользователей'])}`;

/* ---------- сводки для таблицы правил ---------- */

export interface ScopeLine {
  name: string;
  detail: string;
  warn?: boolean;
}

/** «Воронки и этапы»: строка на воронку (как funSummary в концепте) и строка покупателей. */
export function scopeLines(rule: TaskControlRule, refs?: CrmReferences): ScopeLine[] {
  const lines: ScopeLine[] = rule.pipelines.map(({ pipelineId, statusIds }) => {
    const pipeline = refs?.pipelines.find((p) => p.id === pipelineId);
    const name = pipeline?.name ?? `Воронка ${pipelineId || '—'}`;
    if (!statusIds.length) return { name, detail: 'нет этапов', warn: true };
    if (
      pipeline &&
      pipelineState(statusIds, pipeline) === 'all' &&
      statusIds.length === openStatuses(pipeline).length
    )
      return { name, detail: 'вся воронка' };
    const names = pipeline
      ? statusIds.map((id) => pipeline.statuses.find((status) => status.id === id)?.name)
      : [];
    if (statusIds.length <= 2 && names.every(Boolean)) return { name, detail: names.join(', ') };
    return { name, detail: stageWord(statusIds.length) };
  });
  if (rule.customers) {
    const ids = rule.customerStatuses;
    const names = ids.map((id) => refs?.customerStatuses.find((status) => status.id === id)?.name);
    lines.push({
      name: 'Покупатели',
      detail: !ids.length
        ? 'все статусы'
        : ids.length <= 2 && names.every(Boolean)
          ? names.join(', ')
          : `${ids.length} ${plural(ids.length, ['статус', 'статуса', 'статусов'])}`,
    });
  }
  return lines;
}

/** «Ограничения»: что виджет делает по правилу. */
export function ruleLimits(rule: TaskControlRule): string[] {
  const limits: string[] = [];
  if (rule.denyExit)
    limits.push(rule.checkResponsible ? 'Нельзя выйти: ответственный' : 'Нельзя выйти: все');
  if (rule.showModal) limits.push('Окно создания задачи');
  return limits;
}

export type RuleChange = 'new' | 'changed';
/** Отличие правила от сохранённого набора — для пометки строки в таблице. */
export function ruleChange(
  rule: TaskControlRule,
  saved: TaskControlRule[],
): RuleChange | undefined {
  const before = saved.find((item) => item.ruleUid === rule.ruleUid);
  if (!before) return 'new';
  return JSON.stringify(before) === JSON.stringify(rule) ? undefined : 'changed';
}

/** Сколько правил добавлено, изменено или удалено относительно сохранённого набора. */
export function countChanges(rules: TaskControlRule[], saved: TaskControlRule[]): number {
  const removed = saved.filter((item) => !rules.some((rule) => rule.ruleUid === item.ruleUid));
  return rules.filter((rule) => ruleChange(rule, saved)).length + removed.length;
}

/** Убирает или добавляет ID, сохраняя порядок уже выбранных. */
export function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}
