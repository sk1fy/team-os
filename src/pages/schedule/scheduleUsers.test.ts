import { describe, expect, it } from 'vitest';
import type { User } from '@/types';
import { filterScheduleUsers } from './scheduleUsers';

const users: User[] = [
  {
    id: 'local-user',
    email: 'local@example.com',
    firstName: 'Локальный',
    lastName: 'Сотрудник',
    role: 'employee',
    status: 'active',
    source: 'local',
    positionIds: [],
    createdAt: '2026-07-16T00:00:00Z',
  },
  {
    id: 'hidden-user',
    email: 'hidden@example.com',
    firstName: 'Скрытый',
    lastName: 'Сотрудник',
    role: 'employee',
    status: 'active',
    showInSchedule: false,
    positionIds: [],
    createdAt: '2026-07-16T00:00:00Z',
  },
  {
    id: 'owner-user',
    email: 'owner@example.com',
    firstName: 'Владелец',
    lastName: 'Компании',
    role: 'owner',
    status: 'active',
    showInSchedule: true,
    positionIds: [],
    createdAt: '2026-07-16T00:00:00Z',
  },
  {
    id: 'amo-user',
    email: 'amo@example.com',
    firstName: 'Импортированный',
    lastName: 'Сотрудник',
    role: 'employee',
    status: 'active',
    source: 'amo',
    positionIds: [],
    createdAt: '2026-07-16T00:00:00Z',
  },
];

describe('filterScheduleUsers', () => {
  it('показывает сотрудников без созданного шаблона графика', () => {
    const result = filterScheduleUsers(users, {
      search: '',
      chip: 'all',
      positionById: new Map(),
      stateToday: () => undefined,
    });

    expect(result.map((user) => user.id)).toEqual(['local-user', 'amo-user']);
  });

  it('скрывает владельца и сотрудников с выключенным флагом', () => {
    const result = filterScheduleUsers(users, {
      search: '',
      chip: 'all',
      positionById: new Map(),
      stateToday: () => undefined,
    });

    expect(result.map((user) => user.id)).toEqual(['local-user', 'amo-user']);
  });

  it('не считает сотрудника без графика работающим или отсутствующим', () => {
    const common = {
      search: '',
      positionById: new Map(),
      stateToday: () => undefined,
    };

    expect(filterScheduleUsers(users, { ...common, chip: 'working' })).toEqual([]);
    expect(filterScheduleUsers(users, { ...common, chip: 'absent' })).toEqual([]);
  });
});
