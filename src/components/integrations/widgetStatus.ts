import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/api';
import { activityControlApi } from '@/api/activityControl';
import { distributionRuntimeApi } from '@/api/distributionRuntime';
import { queryKeys } from '@/api/queryKeys';
import { taskControlApi } from '@/api/taskControl';
import type { WidgetGroupId, WidgetId } from '@/components/layout/navigation';
import { widgetsOfGroup } from '@/components/layout/navigation';

/**
 * Статус виджета — точка в рейле и в панели группы:
 * ok — работает; warn — ошибка или нет связи; setup — нужно подключить или
 * настроить; off — не подключён в TeamOS (пустой кружок).
 */
export type WidgetLevel = 'ok' | 'warn' | 'setup' | 'off';

export interface WidgetStatus {
  level: WidgetLevel;
  label: string;
}

export const widgetLevelLabels: Record<WidgetLevel, string> = {
  ok: 'Работает',
  warn: 'Требует внимания',
  setup: 'Не настроен',
  off: 'Не подключён',
};

const OFF: WidgetStatus = { level: 'off', label: 'Не подключён' };
const CHECKING: WidgetStatus = { level: 'ok', label: 'Проверяем статус…' };

/**
 * Статусы подключённых виджетов. Запросы лёгкие и кешируются на минуту;
 * для ролей без доступа к интеграциям не выполняются.
 */
export function useWidgetStatuses(enabled: boolean): Record<WidgetId, WidgetStatus> {
  const company = useQuery({
    queryKey: queryKeys.company,
    queryFn: authApi.getCompany,
    enabled,
  });
  const accountId = company.data?.amoAccountId?.trim() ?? '';
  const companyId = company.data?.id;

  const taskControl = useQuery({
    queryKey: ['task-control', 'installation', accountId],
    queryFn: ({ signal }) => taskControlApi.getTaskControlInstallation(accountId, signal),
    enabled: enabled && !!accountId,
    retry: false,
    staleTime: 60_000,
  });
  const activity = useQuery({
    queryKey: ['activity-control', companyId, 'connection'],
    queryFn: ({ signal }) => activityControlApi.connection(signal),
    enabled: enabled && !!companyId,
    retry: false,
    staleTime: 60_000,
  });
  const distribution = useQuery({
    queryKey: queryKeys.distribution.runtime('connections'),
    queryFn: ({ signal }) => distributionRuntimeApi.connections(signal),
    enabled,
    retry: false,
    staleTime: 60_000,
  });

  const taskControlStatus: WidgetStatus = !enabled
    ? OFF
    : company.isSuccess && !accountId
      ? { level: 'setup', label: 'amoCRM не подключена в профиле компании' }
      : taskControl.isError
        ? { level: 'warn', label: 'Нет связи с сервисом — статус установки неизвестен' }
        : !taskControl.data
          ? CHECKING
          : taskControl.data.state === 'installed'
            ? { level: 'ok', label: 'Работает' }
            : taskControl.data.state === 'notInstalled'
              ? { level: 'setup', label: 'Виджет не установлен в amoCRM' }
              : { level: 'warn', label: 'Статус установки неизвестен' };

  const activityStatus: WidgetStatus = !enabled
    ? OFF
    : activity.isError
      ? { level: 'warn', label: 'Нет связи с Activity' }
      : !activity.data
        ? CHECKING
        : activity.data.state === 'configured'
          ? { level: 'ok', label: 'Работает' }
          : activity.data.state === 'unconfigured'
            ? { level: 'setup', label: activity.data.message || 'Не настроен' }
            : { level: 'warn', label: activity.data.message || 'Activity недоступен' };

  const distributionStatus: WidgetStatus = !enabled
    ? OFF
    : distribution.isError
      ? { level: 'warn', label: 'Нет связи с сервисом распределения' }
      : !distribution.data
        ? CHECKING
        : distribution.data.some((connection) => connection.state === 'active')
          ? { level: 'ok', label: 'Работает' }
          : distribution.data.some((connection) => connection.state === 'pending')
            ? { level: 'setup', label: 'Подключение amoCRM ожидает подтверждения' }
            : { level: 'setup', label: 'amoCRM не подключена' };

  const statuses = {} as Record<WidgetId, WidgetStatus>;
  for (const group of [
    'tasks',
    'analytics',
    'automation',
    'deals',
    'communication',
    'fields',
  ] as const) {
    for (const widget of widgetsOfGroup(group)) statuses[widget.id] = OFF;
  }
  statuses['task-control'] = taskControlStatus;
  statuses['activity-control'] = activityStatus;
  statuses['task-queue'] = activityStatus;
  statuses.distribution = distributionStatus;
  return statuses;
}

/** Уровень группы для точки в рейле: проблема важнее «не настроен». */
export function groupLevel(
  group: WidgetGroupId,
  statuses: Record<WidgetId, WidgetStatus>,
): 'warn' | 'setup' | null {
  const levels = widgetsOfGroup(group)
    .filter((widget) => !widget.shortcutOf)
    .map((widget) => statuses[widget.id]?.level);
  if (levels.includes('warn')) return 'warn';
  if (levels.includes('setup')) return 'setup';
  return null;
}
