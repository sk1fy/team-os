import { fullName } from '@/lib/labels';
import type { Department, ID, Position, User, UserRole, UserStatus } from '@/types';

export type EmployeeSortField = 'name' | 'department' | 'role' | 'status';
export type SortDirection = 'asc' | 'desc';

export interface EmployeeTableFilters {
  search: string;
  departmentId: string;
  role: string;
  status: string;
}

export interface EmployeeLookups {
  positionById: Map<ID, Position>;
  departmentById: Map<ID, Department>;
}

export function getUserDepartmentNames(
  positionIds: ID[],
  { positionById, departmentById }: EmployeeLookups,
): string {
  const names = new Set(
    positionIds
      .map((pid) => positionById.get(pid)?.departmentId)
      .map((did) => (did ? departmentById.get(did)?.name : undefined))
      .filter((name): name is string => Boolean(name)),
  );
  return [...names].sort((a, b) => a.localeCompare(b, 'ru')).join(', ');
}

export function getUserDepartmentSortKey(positionIds: ID[], lookups: EmployeeLookups): string {
  const names = positionIds
    .map((pid) => lookups.positionById.get(pid)?.departmentId)
    .map((did) => (did ? lookups.departmentById.get(did)?.name : undefined))
    .filter((name): name is string => Boolean(name))
    .sort((a, b) => a.localeCompare(b, 'ru'));
  return names[0] ?? '';
}

export function filterEmployees(
  users: User[],
  filters: EmployeeTableFilters,
  lookups: EmployeeLookups,
): User[] {
  const query = filters.search.trim().toLowerCase();

  return users.filter((user) => {
    if (query) {
      const haystack = `${fullName(user)} ${user.email}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    if (filters.departmentId !== 'all') {
      const userDepartmentIds = user.positionIds
        .map((pid) => lookups.positionById.get(pid)?.departmentId)
        .filter((id): id is ID => Boolean(id));
      if (!userDepartmentIds.includes(filters.departmentId)) return false;
    }

    if (filters.role !== 'all' && user.role !== filters.role) return false;
    if (filters.status !== 'all' && user.status !== filters.status) return false;

    return true;
  });
}

const roleOrder: Record<UserRole, number> = {
  owner: 0,
  admin: 1,
  employee: 2,
  partner: 3,
};

const statusOrder: Record<UserStatus, number> = {
  active: 0,
  invited: 1,
  deactivated: 2,
};

export function sortEmployees(
  users: User[],
  field: EmployeeSortField,
  direction: SortDirection,
  lookups: EmployeeLookups,
): User[] {
  const sorted = [...users].sort((a, b) => {
    let cmp = 0;

    switch (field) {
      case 'name':
        cmp = fullName(a).localeCompare(fullName(b), 'ru');
        break;
      case 'department':
        cmp = getUserDepartmentSortKey(a.positionIds, lookups).localeCompare(
          getUserDepartmentSortKey(b.positionIds, lookups),
          'ru',
        );
        break;
      case 'role':
        cmp = roleOrder[a.role] - roleOrder[b.role];
        break;
      case 'status':
        cmp = statusOrder[a.status] - statusOrder[b.status];
        break;
    }

    return direction === 'asc' ? cmp : -cmp;
  });

  return sorted;
}

export function paginateEmployees<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    totalPages,
    totalItems: items.length,
  };
}
