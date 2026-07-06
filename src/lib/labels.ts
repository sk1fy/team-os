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
export function fullName(user: { firstName: string; lastName: string }) {
  return `${user.firstName} ${user.lastName}`;
}
