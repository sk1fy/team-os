import type { ID, Position, User, UserRole } from '@/types';
import type { DayState } from '@/lib/schedule';
import { fullName } from '@/lib/labels';

interface ScheduleUserFilter {
  search: string;
  chip: 'all' | 'working' | 'absent';
  positionById: Map<ID, Position>;
  stateToday: (userId: ID) => DayState | undefined;
}

/**
 * Фильтрует уже выбранную группу активных/уволенных сотрудников.
 * Наличие шаблона графика намеренно не проверяется: новый сотрудник должен
 * оставаться видимым, чтобы руководитель мог открыть карточку и настроить его.
 */
export function filterScheduleUsers(users: User[], filter: ScheduleUserFilter): User[] {
  const normalizedSearch = filter.search.trim().toLowerCase();
  return users.filter((user) => {
    if (!isUserShownInSchedule(user)) return false;
    const position = user.positionIds[0] ? filter.positionById.get(user.positionIds[0]) : undefined;
    const haystack = `${fullName(user)} ${user.email} ${position?.name ?? ''}`.toLowerCase();
    if (normalizedSearch && !haystack.includes(normalizedSearch)) return false;
    const stateType = filter.stateToday(user.id)?.type;
    if (filter.chip === 'working') return stateType === 'work' || stateType === 'trip';
    if (filter.chip === 'absent') return stateType === 'vacation' || stateType === 'sick';
    return true;
  });
}

export function scheduleEmptyStatePresentation(hasActiveFilters: boolean) {
  return hasActiveFilters
    ? {
        title: 'Сотрудники не найдены',
        description: 'Измените поисковый запрос или сбросьте фильтры.',
      }
    : {
        title: 'В графике пока нет сотрудников',
        description: 'Активируйте нужных людей в разделе «Сотрудники» или в их карточках.',
      };
}

/** Обычный сотрудник всегда видит общий график активных коллег без просмотра уволенных. */
export function selectScheduleStaffUsers(
  users: User[],
  viewerRole: UserRole | undefined,
  staff: 'active' | 'fired',
): User[] {
  const effectiveStaff = viewerRole === 'employee' ? 'active' : staff;
  return users.filter(
    (user) =>
      isUserShownInSchedule(user) &&
      (effectiveStaff === 'fired' ? user.status === 'deactivated' : user.status !== 'deactivated'),
  );
}

/** Сотрудник попадает в график только после явной активации. */
export function isUserShownInSchedule(user: User): boolean {
  return isScheduleEligibleUser(user) && user.showInSchedule === true;
}

/** В рабочий график можно добавить владельца, администратора или сотрудника, но не партнёра. */
export function isScheduleEligibleUser(user: User): boolean {
  return user.role === 'owner' || user.role === 'admin' || user.role === 'employee';
}
