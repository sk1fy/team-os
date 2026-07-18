/** Русские подписи и цвета бейджей для перечислимых полей сущностей. */

import type { TaskPriority, UserRole, UserStatus } from '@/types';

type BadgeVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

export const roleLabels: Record<UserRole, string> = {
  owner: 'Владелец',
  admin: 'Администратор',
  employee: 'Сотрудник',
  partner: 'Партнёр',
};

export const roleVariants: Record<UserRole, BadgeVariant> = {
  owner: 'primary',
  admin: 'primary',
  employee: 'neutral',
  partner: 'warning',
};

export const userStatusLabels: Record<UserStatus, string> = {
  active: 'Активен',
  invited: 'Ожидает активации',
  deactivated: 'Деактивирован',
};

export const userStatusVariants: Record<UserStatus, BadgeVariant> = {
  active: 'success',
  invited: 'warning',
  deactivated: 'neutral',
};

export const priorityLabels: Record<TaskPriority, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  urgent: 'Срочно',
};

export const priorityVariants: Record<TaskPriority, BadgeVariant> = {
  low: 'neutral',
  medium: 'primary',
  high: 'warning',
  urgent: 'danger',
};

/** Полное имя пользователя. */
export function fullName(user: { firstName: string; lastName?: string }) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
}

/** Русское склонение по числу: pluralRu(3, 'год', 'года', 'лет') → 'года'. */
export function pluralRu(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
