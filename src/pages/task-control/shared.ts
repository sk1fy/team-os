import type { UseQueryResult } from '@tanstack/react-query';
import type { Company } from '@/types';
import type { TaskControlConnection } from '@/api/taskControl';
import { tabHref } from '@/components/layout/navigation';

export const TASK_CONTROL_DESCRIPTION =
  'Правила для amoCRM. Проверка задач выполняется внутри виджета.';
export const CONNECTION_TAB_HREF = tabHref('/task-control', 'connection', 'rules');

type Installation = TaskControlConnection['installation'];

/** Общие данные страницы: аккаунт, установка виджета и подключение правил. */
export interface TaskControlState {
  company: UseQueryResult<Company>;
  account: string;
  status: UseQueryResult<Installation>;
  connections: UseQueryResult<TaskControlConnection[]>;
  connection: TaskControlConnection | undefined;
  installed: boolean;
}

/** Тексты состояния установки — те же, что и в прежней версии страницы. */
export function installationText(state: Installation['state'] | undefined) {
  return state === 'installed'
    ? 'Виджет установлен'
    : state === 'notInstalled'
      ? 'Виджет не установлен. Интеграция неактивна.'
      : 'Статус установки неизвестен. Проверьте связь с Core и обновите статус.';
}

const dateTime = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
export function formatDateTime(iso: string | undefined) {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : dateTime.format(date);
}
