import type { ID, Position, User } from '@/types';
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
    const position = user.positionIds[0] ? filter.positionById.get(user.positionIds[0]) : undefined;
    const haystack = `${fullName(user)} ${user.email} ${position?.name ?? ''}`.toLowerCase();
    if (normalizedSearch && !haystack.includes(normalizedSearch)) return false;
    const stateType = filter.stateToday(user.id)?.type;
    if (filter.chip === 'working') return stateType === 'work' || stateType === 'trip';
    if (filter.chip === 'absent') return stateType === 'vacation' || stateType === 'sick';
    return true;
  });
}
