import { describe, expect, it } from 'vitest';
import type { Department, Position, User } from '@/types';
import {
  filterEmployees,
  getUserDepartmentNames,
  paginateEmployees,
  sortEmployees,
} from './employeeTable';

const departments: Department[] = [
  { id: 'dep-sales', name: 'Продажи', parentId: null, order: 0 },
  { id: 'dep-dev', name: 'Разработка', parentId: null, order: 1 },
];

const positions: Position[] = [
  {
    id: 'pos-sales',
    name: 'Менеджер',
    departmentId: 'dep-sales',
    articleIds: [],
    requiredCourseIds: [],
  },
  {
    id: 'pos-dev',
    name: 'Разработчик',
    departmentId: 'dep-dev',
    articleIds: [],
    requiredCourseIds: [],
  },
];

const lookups = {
  positionById: new Map(positions.map((p) => [p.id, p])),
  departmentById: new Map(departments.map((d) => [d.id, d])),
};

const users: User[] = [
  {
    id: 'u-1',
    email: 'anna@company.ru',
    firstName: 'Анна',
    lastName: 'Смирнова',
    role: 'owner',
    status: 'active',
    positionIds: ['pos-sales'],
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'u-2',
    email: 'ivan@company.ru',
    firstName: 'Иван',
    lastName: 'Петров',
    role: 'employee',
    status: 'invited',
    positionIds: ['pos-dev'],
    createdAt: '2026-01-02T00:00:00.000Z',
  },
  {
    id: 'u-3',
    email: 'partner@agency.ru',
    firstName: 'Павел',
    lastName: 'Никитин',
    role: 'partner',
    status: 'active',
    positionIds: [],
    createdAt: '2026-01-03T00:00:00.000Z',
  },
];

describe('employeeTable helpers', () => {
  it('фильтрует по поиску, отделу, роли и статусу', () => {
    const filtered = filterEmployees(
      users,
      {
        search: 'иван',
        departmentId: 'dep-dev',
        role: 'employee',
        status: 'invited',
      },
      lookups,
    );
    expect(filtered.map((u) => u.id)).toEqual(['u-2']);
  });

  it('учитывает все должности при фильтре по отделу', () => {
    const multiDeptUser: User = {
      ...users[0],
      id: 'u-4',
      positionIds: ['pos-sales', 'pos-dev'],
    };
    const filtered = filterEmployees(
      [...users, multiDeptUser],
      {
        search: '',
        departmentId: 'dep-dev',
        role: 'all',
        status: 'all',
      },
      lookups,
    );
    expect(filtered.map((u) => u.id)).toEqual(['u-2', 'u-4']);
  });

  it('собирает названия отделов для сотрудника без должностей', () => {
    expect(getUserDepartmentNames([], lookups)).toBe('');
    expect(getUserDepartmentNames(['pos-sales', 'pos-dev'], lookups)).toBe('Продажи, Разработка');
  });

  it('сортирует по имени и роли', () => {
    const byName = sortEmployees(users, 'name', 'asc', lookups).map((u) => u.id);
    expect(byName).toEqual(['u-1', 'u-2', 'u-3']);

    const byRole = sortEmployees(users, 'role', 'asc', lookups).map((u) => u.id);
    expect(byRole[0]).toBe('u-1');
    expect(byRole.at(-1)).toBe('u-3');
  });

  it('пагинирует и нормализует номер страницы', () => {
    const page1 = paginateEmployees(users, 1, 2);
    expect(page1.items).toHaveLength(2);
    expect(page1.totalPages).toBe(2);

    const overflow = paginateEmployees(users, 99, 2);
    expect(overflow.page).toBe(2);
    expect(overflow.items).toHaveLength(1);
  });
});
