/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from 'react';
import { ApiError } from '@/api/client';
import { Badge, Button } from '@/components/ui';
export const isAccessDenied = (error: unknown) =>
  error instanceof ApiError && (error.status === 401 || error.status === 403);
export function useVisiblePolling() {
  const [active, setActive] = useState(!document.hidden && navigator.onLine);
  useEffect(() => {
    const update = () => setActive(!document.hidden && navigator.onLine);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return {
    staleTime: 0,
    refetchInterval: active ? 15000 : (false as const),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: 1,
  };
}
export function Failure({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-danger-200 bg-danger-50 p-4 text-sm">
      <p>
        {error instanceof ApiError && error.status === 403
          ? 'Нет прав для работы с распределением. Обратитесь к администратору.'
          : error instanceof Error
            ? error.message
            : 'Источник данных недоступен.'}
      </p>
      <Button variant="secondary" size="sm" className="mt-3" onClick={retry}>
        Повторить загрузку
      </Button>
    </div>
  );
}
export const reasonLabels: Record<string, string> = {
  algorithm_unsupported: 'Выберите распределение по очереди',
  already_target: 'Сделка уже у выбранного сотрудника',
  ambiguous_reentry: 'Нужна проверка повторного входа сделки',
  assigned: 'Назначение подтверждено',
  assignment_confirmed: 'Назначение подтверждено',
  binding_unavailable: 'Подключение amoCRM недоступно',
  cancel_pending: 'Проверяем отмену операции',
  cancelled: 'Распределение отменено',
  crm_users_unavailable: 'Не удалось проверить пользователей amoCRM',
  current_owner_kept: 'Оставлена у текущего ответственного',
  decision_expired: 'Решение устарело, требуется перерасчёт',
  decision_ready: 'Ответственный выбран',
  decision_recalculation: 'Пересчитываем ответственного',
  group_operation_unfinished: 'Ожидает завершения предыдущей сделки группы',
  lead_operation_unfinished: 'Ожидает завершения предыдущей операции сделки',
  no_valid_members_within_horizon: 'Нет подходящих смен в ближайший период',
  observed_stage_exit: 'Сделка вышла из этапа распределения',
  operation_unavailable: 'Не удалось проверить операцию',
  operation_unfinished: 'Операция ещё не завершена',
  outcome_unknown: 'Результат назначения уточняется',
  policy_unavailable: 'Не удалось проверить правило распределения',
  recipient_unavailable: 'Выбранный сотрудник больше недоступен',
  requires_configuration: 'Проверьте настройки распределения',
  source_changed: 'Данные сделки изменились',
  timezone_required: 'Настройте часовой пояс компании',
  no_attempt: 'Назначение ещё не отправлено',
  uncertain: 'Результат назначения уточняется',
  no_available_employee: 'Никто не доступен по графику',
  no_available_members: 'Никто не доступен по графику',
  waiting_for_shift: 'Ожидает начала смены',
  group_paused: 'Группа приостановлена',
  rule_paused: 'Правило приостановлено',
  unknown: 'Результат уточняется',
  needs_configuration: 'Требуется настройка',
  source_unavailable: 'Источник amoCRM недоступен',
  confirmed: 'Назначение подтверждено',
  keep_current: 'Оставлена у текущего ответственного',
  mapping_unavailable: 'Проверьте связь сотрудника с amoCRM',
  source_time_unknown: 'Неизвестно время события',
  off_shift: 'Не на смене',
  available: 'Доступен',
  disabled: 'Выключен',
  unmapped: 'Нет связи с amoCRM',
};
export const reasonText = (value: string) =>
  reasonLabels[value] ?? 'Требуется проверка состояния распределения';
export function StateBadge({ state }: { state: string }) {
  const labels: Record<string, string> = {
    checking: 'Проверяем результат',
    uncertain: 'Результат уточняется',
    dispatching: 'Назначается',
    confirming: 'Ожидаем подтверждения',
    errors: 'Требует внимания',
    waiting: 'Ожидает',
    ready: 'Ожидает',
    assigning: 'Назначается',
    processing: 'Назначается',
    sent: 'Назначается',
    succeeded: 'Завершено',
    confirmed: 'Завершено',
    completed: 'Завершено',
    kept: 'Оставлена у ответственного',
    failed: 'Ошибка',
    error: 'Ошибка',
    cancelled: 'Отменена',
    unknown: 'Результат уточняется',
    needs_verification: 'Результат уточняется',
    needs_configuration: 'Требуется настройка',
  };
  return (
    <Badge
      variant={
        ['confirmed', 'completed', 'succeeded', 'kept'].includes(state)
          ? 'success'
          : ['failed', 'error'].includes(state)
            ? 'danger'
            : 'neutral'
      }
    >
      {labels[state] ?? state}
    </Badge>
  );
}
export const dateText = (value: string | null | undefined, timezone?: string | null) =>
  value
    ? new Intl.DateTimeFormat('ru-RU', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: timezone || undefined,
      }).format(new Date(value))
    : '—';
export const panelClass = 'rounded-lg border border-slate-200 bg-surface p-5 shadow-card';
