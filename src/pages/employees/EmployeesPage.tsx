import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTitle } from 'react-use';
import { Search, UserPlus } from 'lucide-react';
import { orgApi } from '@/api';
import {
  fullName,
  roleLabels,
  roleVariants,
  userStatusLabels,
  userStatusVariants,
} from '@/lib/labels';
import { plural } from '@/lib/format';
import { Avatar, Badge, Button, Select } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { InviteModal } from './InviteModal';

export function EmployeesPage() {
  useTitle('Сотрудники — TeamOS');
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [inviteOpen, setInviteOpen] = useState(false);

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: orgApi.getUsers });
  const positionsQuery = useQuery({ queryKey: ['positions'], queryFn: orgApi.getPositions });
  const departmentsQuery = useQuery({
    queryKey: ['departments'],
    queryFn: orgApi.getDepartments,
  });

  const positionById = useMemo(
    () => new Map((positionsQuery.data ?? []).map((p) => [p.id, p])),
    [positionsQuery.data],
  );
  const departmentById = useMemo(
    () => new Map((departmentsQuery.data ?? []).map((d) => [d.id, d])),
    [departmentsQuery.data],
  );

  const departmentOptions = useMemo(
    () => [
      { value: 'all', label: 'Все отделы' },
      ...(departmentsQuery.data ?? []).map((d) => ({ value: d.id, label: d.name })),
    ],
    [departmentsQuery.data],
  );

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (usersQuery.data ?? []).filter((user) => {
      if (query) {
        const haystack = `${fullName(user)} ${user.email}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (departmentFilter !== 'all') {
        const userDepartmentIds = user.positionIds.map(
          (pid) => positionById.get(pid)?.departmentId,
        );
        if (!userDepartmentIds.includes(departmentFilter)) return false;
      }
      return true;
    });
  }, [usersQuery.data, search, departmentFilter, positionById]);

  const userPositionNames = (positionIds: string[]) =>
    positionIds
      .map((pid) => positionById.get(pid)?.name)
      .filter(Boolean)
      .join(', ');

  const userDepartmentNames = (positionIds: string[]) => {
    const names = new Set(
      positionIds
        .map((pid) => positionById.get(pid)?.departmentId)
        .map((did) => (did ? departmentById.get(did)?.name : undefined))
        .filter((name): name is string => Boolean(name)),
    );
    return [...names].join(', ');
  };

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
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="size-4" />
            Пригласить
          </Button>
        }
      />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Поиск по имени или email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-slate-300 bg-surface pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary-400"
          />
        </div>
        <Select
          options={departmentOptions}
          value={departmentFilter}
          onValueChange={setDepartmentFilter}
          className="sm:w-56"
        />
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-surface shadow-card">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="border-b border-slate-200 text-xs tracking-wide text-slate-400 uppercase">
              <th className="px-4 py-3 font-semibold">Сотрудник</th>
              <th className="px-4 py-3 font-semibold">Должность</th>
              <th className="px-4 py-3 font-semibold">Отдел</th>
              <th className="px-4 py-3 font-semibold">Роль</th>
              <th className="px-4 py-3 font-semibold">Статус</th>
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

            {usersQuery.isSuccess && filteredUsers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                  Никого не нашлось. Измените запрос или фильтр.
                </td>
              </tr>
            )}

            {filteredUsers.map((user) => (
              <tr
                key={user.id}
                onClick={() => navigate(`/employees/${user.id}`)}
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
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {userPositionNames(user.positionIds) || '—'}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {userDepartmentNames(user.positionIds) || '—'}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={roleVariants[user.role]}>{roleLabels[user.role]}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={userStatusVariants[user.status]}>
                    {userStatusLabels[user.status]}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
