import type { Group, References, Rule } from '@/api/distributionRuntime';
import type { PillTone } from './ui';

type Pipeline = References['pipelines'][number];

/** Правило группы: включённое, иначе любое сохранённое. */
export function ruleForGroup(rules: Rule[] | undefined, groupId: string | undefined) {
  return (
    rules?.find((r) => r.groupId === groupId && r.active) ??
    rules?.find((r) => r.groupId === groupId)
  );
}

/** Статус группы для пилюли на карточке и странице группы. */
export function groupStatus(
  group: Pick<Group, 'active'>,
  rule: Rule | undefined,
): { label: string; tone: PillTone } {
  if (!rule) return { label: 'Требуется настройка', tone: 'amber' };
  if (!(rule.active && group.active)) return { label: 'Приостановлена', tone: 'neutral' };
  if (rule.executionMode === 'observe') return { label: 'Наблюдение', tone: 'blue' };
  return { label: 'Работает', tone: 'green' };
}

/** Где срабатывает правило: воронка и этап с учётом типа запуска. */
export function funnelText(rule: Rule | undefined, pipelines: Pipeline[] | undefined) {
  if (!rule) return 'Воронка и этап не выбраны';
  if (rule.source === 'digital_pipeline') return 'Триггер на этапе в Digital Pipeline';
  const pipeline = pipelines?.find((p) => p.id === rule.pipelineId);
  const pipelineName = pipeline?.name ?? `Воронка ${rule.pipelineId}`;
  if (rule.source === 'creation') return `${pipelineName} · при создании сделки`;
  const status = pipeline?.statuses.find((s) => s.id === rule.statusId)?.name;
  return `${pipelineName} › ${status ?? `Этап ${rule.statusId}`}`;
}

export const sourceLabels: Record<Rule['source'], string> = {
  creation: 'При создании сделки в выбранной воронке',
  digital_pipeline: 'По триггеру на этапе',
  legacy_stage: 'Существующее правило: вебхук на этапе',
};
