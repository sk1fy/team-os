/** Подписи и форматтеры Академии Opus (без React-компонентов). */

import type { CourseProgressStatus, User } from '@/types';

export const statusLabels: Record<CourseProgressStatus, string> = {
  not_started: 'Не начат',
  in_progress: 'В процессе',
  completed: 'Завершён',
  overdue: 'Просрочен',
};

export const statusVariants: Record<
  CourseProgressStatus,
  'neutral' | 'primary' | 'success' | 'danger'
> = {
  not_started: 'neutral',
  in_progress: 'primary',
  completed: 'success',
  overdue: 'danger',
};

/** Как курс попал к человеку — колонка «Источник» в отчёте. */
export const viaLabels: Record<'user' | 'position' | 'department', string> = {
  user: 'Лично',
  position: 'Должность',
  department: 'Отдел',
};

export function fullName(user: User | undefined) {
  if (!user) return 'Сотрудник';
  return `${user.firstName} ${user.lastName}`.trim();
}
