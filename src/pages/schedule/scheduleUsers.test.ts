import { describe, expect, it } from 'vitest';
import type { User } from '@/types';
import {
  filterScheduleUsers,
  scheduleEmptyStatePresentation,
  selectScheduleStaffUsers,
} from './scheduleUsers';

const users: User[] = [
  {
    id: 'local-user',
    email: 'local@example.com',
    firstName: 'Локальный',
    lastName: 'Сотрудник',
    role: 'employee',
    status: 'active',
    source: 'local',
    showInSchedule: true,
    positionIds: [],
    createdAt: '2026-07-16T00:00:00Z',
  },
  {
    id: 'inactive-user',
    email: 'inactive@example.com',
    firstName: 'Неактивированный',
    lastName: 'Сотрудник',
    role: 'employee',
    status: 'active',
    source: 'amo',
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
    showInSchedule: true,
    positionIds: [],
    createdAt: '2026-07-16T00:00:00Z',
  },
  {
    id: 'fired-user',
    email: 'fired@example.com',
    firstName: 'Уволенный',
    lastName: 'Сотрудник',
    role: 'employee',
    status: 'deactivated',
    showInSchedule: true,
    positionIds: [],
    createdAt: '2026-07-16T00:00:00Z',
  },
];

describe('filterScheduleUsers', () => {
  it('показывает активированных сотрудников без созданного шаблона графика', () => {
    const result = filterScheduleUsers(
      users.filter((user) => user.status !== 'deactivated'),
      {
        search: '',
        chip: 'all',
        positionById: new Map(),
        stateToday: () => undefined,
      },
    );

    expect(result.map((user) => user.id)).toEqual(['local-user', 'amo-user']);
  });

  it('скрывает владельца и сотрудников без явной активации', () => {
    const result = filterScheduleUsers(
      users.filter((user) => user.status !== 'deactivated'),
      {
        search: '',
        chip: 'all',
        positionById: new Map(),
        stateToday: () => undefined,
      },
    );

    expect(result.map((user) => user.id)).toEqual(['local-user', 'amo-user']);
  });

  it('не считает сотрудника без графика работающим или отсутствующим', () => {
    const common = {
      search: '',
      positionById: new Map(),
      stateToday: () => undefined,
    };

    const activeUsers = users.filter((user) => user.status !== 'deactivated');
    expect(filterScheduleUsers(activeUsers, { ...common, chip: 'working' })).toEqual([]);
    expect(filterScheduleUsers(activeUsers, { ...common, chip: 'absent' })).toEqual([]);
  });
});

describe('selectScheduleStaffUsers', () => {
  it('показывает обычному сотруднику всех активных коллег, даже если выбран фильтр уволенных', () => {
    const result = selectScheduleStaffUsers(users, 'employee', 'fired');

    expect(result.map((user) => user.id)).toEqual(['local-user', 'amo-user']);
  });

  it('сохраняет фильтр активных и уволенных для руководителей', () => {
    expect(selectScheduleStaffUsers(users, 'admin', 'fired').map((user) => user.id)).toEqual([
      'fired-user',
    ]);
  });
});

describe('scheduleEmptyStatePresentation', () => {
  it('явно объясняет пустой результат поиска', () => {
    expect(scheduleEmptyStatePresentation(true)).toEqual({
      title: 'Сотрудники не найдены',
      description: 'Измените поисковый запрос или сбросьте фильтры.',
    });
  });

  it('отличает пустой график от отфильтрованного результата', () => {
    expect(scheduleEmptyStatePresentation(false).title).toBe('В графике пока нет сотрудников');
  });
});
