import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
} from 'lucide-react';
import { orgApi } from '@/api';
import type { ID } from '@/types';
import {
  fullName,
  roleLabels,
  roleVariants,
  userStatusLabels,
  userStatusVariants,
} from '@/lib/labels';
import { plural } from '@/lib/format';
import { Avatar, Badge, Button, Select, Tabs } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { AddUserModal } from './AddUserModal';
import { EmployeeDrawer } from './EmployeeDrawer';
import { StructurePage } from '@/pages/structure/StructurePage';
import {
  filterEmployees,
  getUserDepartmentNames,
  paginateEmployees,
  sortEmployees,
  type EmployeeSortField,
  type SortDirection,
} from './employeeTable';

const PAGE_SIZE = 10;

const roleFilterOptions = [
  { value: 'all', label: 'Все роли' },
  { value: 'owner', label: roleLabels.owner },
  { value: 'admin', label: roleLabels.admin },
  { value: 'employee', label: roleLabels.employee },
  { value: 'partner', label: roleLabels.partner },
];

const statusFilterOptions = [
  { value: 'all', label: 'Все статусы' },
  { value: 'active', label: userStatusLabels.active },
  { value: 'invited', label: userStatusLabels.invited },
  { value: 'deactivated', label: userStatusLabels.deactivated },
];

const sortLabels: Record<EmployeeSortField, string> = {
  name: 'Сотрудник',
  department: 'Отдел',
  role: 'Роль',
  status: 'Статус',
};

const tabs = ['employees', 'structure'] as const;
const sortFields = ['name', 'department', 'role', 'status'] as const;
const sortDirections = ['asc', 'desc'] as const;

function oneOf<T extends readonly string[]>(value: string | null, values: T, fallback: T[number]) {
  return values.includes(value ?? '') ? (value as T[number]) : fallback;
}

function SortIcon({
  field,
  activeField,
  direction,
}: {
  field: EmployeeSortField;
  activeField: EmployeeSortField;
  direction: SortDirection;
}) {
  if (field !== activeField) return <ArrowUpDown className="size-3.5 opacity-40" />;
  return direction === 'asc' ? (
    <ArrowUp className="size-3.5" />
  ) : (
    <ArrowDown className="size-3.5" />
  );
}

export function EmployeesPage() {
  useTitle('Сотрудники — TeamOS');
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = oneOf(searchParams.get('tab'), tabs, 'employees');
  const search = searchParams.get('q') ?? '';
  const departmentFilter = searchParams.get('department') ?? 'all';
  const roleFilter = searchParams.get('role') ?? 'all';
  const statusFilter = searchParams.get('status') ?? 'all';
  const sortField = oneOf(searchParams.get('sort'), sortFields, 'name') as EmployeeSortField;
  const sortDirection = oneOf(searchParams.get('dir'), sortDirections, 'asc') as SortDirection;
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const addUserOpen = searchParams.get('addUser') === '1';
  const selectedEmployeeId = searchParams.get('drawer') as ID | null;

  const updateParams = useCallback(
    (updates: Record<string, string | null>, resetPage = false) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(updates)) {
            if (value === null || value === '') next.delete(key);
            else next.set(key, value);
          }
          if (resetPage) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: orgApi.getUsers });
  const positionsQuery = useQuery({ queryKey: ['positions'], queryFn: orgApi.getPositions });
  const departmentsQuery = useQuery({
    queryKey: ['departments'],
    queryFn: orgApi.getDepartments,
  });

  const lookups = useMemo(
    () => ({
      positionById: new Map((positionsQuery.data ?? []).map((p) => [p.id, p])),
      departmentById: new Map((departmentsQuery.data ?? []).map((d) => [d.id, d])),
    }),
    [positionsQuery.data, departmentsQuery.data],
  );

  const departmentOptions = useMemo(
    () => [
      { value: 'all', label: 'Все отделы' },
      ...(departmentsQuery.data ?? []).map((d) => ({ value: d.id, label: d.name })),
    ],
    [departmentsQuery.data],
  );

  const processedUsers = useMemo(() => {
    const filtered = filterEmployees(
      usersQuery.data ?? [],
      {
        search,
        departmentId: departmentFilter,
        role: roleFilter,
        status: statusFilter,
      },
      lookups,
    );
    const sorted = sortEmployees(filtered, sortField, sortDirection, lookups);
    return paginateEmployees(sorted, page, PAGE_SIZE);
  }, [
    usersQuery.data,
    search,
    departmentFilter,
    roleFilter,
    statusFilter,
    sortField,
    sortDirection,
    page,
    lookups,
  ]);

  const userPositionNames = (positionIds: string[]) =>
    positionIds
      .map((pid) => lookups.positionById.get(pid)?.name)
      .filter(Boolean)
      .join(', ');

  const toggleSort = (field: EmployeeSortField) => {
    if (sortField === field) {
      updateParams({ dir: sortDirection === 'asc' ? 'desc' : 'asc' }, true);
    } else {
      updateParams({ sort: field, dir: 'asc' }, true);
    }
  };

  const employeesContent = (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Поиск по имени или email…"
            value={search}
            onChange={(e) => updateParams({ q: e.target.value || null }, true)}
            className="h-9.5 w-full rounded-md border border-slate-200 bg-surface pl-9 pr-3 text-sm transition-colors focus:outline-2 focus:-outline-offset-1 focus:outline-primary-600"
          />
        </div>
        <Select
          options={departmentOptions}
          value={departmentFilter}
          onValueChange={(value) => updateParams({ department: value === 'all' ? null : value }, true)}
          className="sm:w-52"
        />
        <Select
          options={roleFilterOptions}
          value={roleFilter}
          onValueChange={(value) => updateParams({ role: value === 'all' ? null : value }, true)}
          className="sm:w-44"
        />
        <Select
          options={statusFilterOptions}
          value={statusFilter}
          onValueChange={(value) => updateParams({ status: value === 'all' ? null : value }, true)}
          className="sm:w-44"
        />
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-surface shadow-card">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b border-slate-200 text-xs tracking-wide text-slate-400 uppercase">
              {(['name', 'department', 'role', 'status'] as EmployeeSortField[]).map((field) => (
                <th key={field} className="px-4 py-3 font-semibold">
                  <button
                    type="button"
                    onClick={() => toggleSort(field)}
                    className="inline-flex items-center gap-1.5 text-left transition-colors hover:text-slate-600"
                  >
                    {field === 'name' ? 'Сотрудник' : sortLabels[field]}
                    <SortIcon field={field} activeField={sortField} direction={sortDirection} />
                  </button>
                </th>
              ))}
              <th className="px-4 py-3 font-semibold">Должность</th>
            </tr>
          </thead>
          <tbody>
            {usersQuery.isPending &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td colSpan={5} className="px-4 py-3">
                    <div className="h-8 animate-pulse rounded bg-slate-200/60" />
                  </td>
                </tr>
              ))}

            {usersQuery.isError && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center">
                  <p className="text-sm text-danger-700">Не удалось загрузить сотрудников.</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-3"
                    onClick={() => usersQuery.refetch()}
                  >
                    Повторить
                  </Button>
                </td>
              </tr>
            )}

            {usersQuery.isSuccess && processedUsers.totalItems === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                  Никого не нашлось. Измените запрос или фильтр.
                </td>
              </tr>
            )}

            {processedUsers.items.map((user) => (
              <tr
                key={user.id}
                onClick={() => updateParams({ drawer: user.id })}
                className="cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={fullName(user)} src={user.avatarUrl} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {fullName(user)}
                      </p>
                      <p className="truncate text-xs text-slate-500">{user.email}</p>
                      {user.source === 'amo' && (
                        <Badge variant="neutral" className="mt-1">
                          amoCRM
                        </Badge>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {getUserDepartmentNames(user.positionIds, lookups) || '—'}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={roleVariants[user.role]}>{roleLabels[user.role]}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={userStatusVariants[user.status]}>
                    {userStatusLabels[user.status]}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {userPositionNames(user.positionIds) || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {processedUsers.totalItems > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <p>
            {processedUsers.totalItems}{' '}
            {plural(processedUsers.totalItems, ['сотрудник', 'сотрудника', 'сотрудников'])}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={processedUsers.page <= 1}
              onClick={() => updateParams({ page: String(processedUsers.page - 1) })}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span>
              {processedUsers.page} / {processedUsers.totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={processedUsers.page >= processedUsers.totalPages}
              onClick={() => updateParams({ page: String(processedUsers.page + 1) })}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="mx-auto max-w-5xl p-6">
      <PageHeader
        title="Сотрудники"
        description={
          usersQuery.data
            ? `${usersQuery.data.length} ${plural(usersQuery.data.length, ['человек', 'человека', 'человек'])} в компании`
            : undefined
        }
        actions={
          <Button onClick={() => updateParams({ addUser: '1' })}>
            <Plus className="size-4" />
            Добавить пользователя
          </Button>
        }
      />

      <Tabs
        value={tab}
        onValueChange={(value) =>
          updateParams({
            tab: value === 'employees' ? null : value,
            drawer: null,
          })
        }
        className="mt-6"
        items={[
          { value: 'employees', label: 'Сотрудники', content: employeesContent },
          { value: 'structure', label: 'Оргструктура', content: <StructurePage embedded /> },
        ]}
      />

      <AddUserModal
        open={addUserOpen}
        onClose={() => updateParams({ addUser: null })}
      />
      <EmployeeDrawer
        userId={selectedEmployeeId}
        onClose={() => updateParams({ drawer: null })}
      />
    </div>
  );
}
