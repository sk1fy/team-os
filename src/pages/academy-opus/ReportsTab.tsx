/**
 * Отчёт по прохождению — Академия Opus.
 *
 * Ключевое отличие от базовой Академии: строки строятся из назначений, а не
 * из прогресса, поэтому в таблице видны и те, кто курс ещё не открывал.
 * Плюс фильтры, сводка сверху и настоящая выгрузка файлом.
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BarChart3, Download, RefreshCw, Users } from 'lucide-react';
import { academyOpusApi } from '@/api/academyOpus';
import { queryKeys } from '@/api/queryKeys';
import type { Course, CourseProgressStatus, Department, Position, User } from '@/types';
import { Badge, Button, Input, Select } from '@/components/ui';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { summarize } from '@/lib/courseProgress';
import { formatDate } from '@/lib/format';
import { downloadCsv } from './csv';
import { DueDateLabel, ProgressBar, StatusBadge } from './shared';
import { fullName, statusLabels, viaLabels } from './labels';

const statusOptions = [
  { value: 'all', label: 'Все статусы' },
  { value: 'not_started', label: statusLabels.not_started },
  { value: 'in_progress', label: statusLabels.in_progress },
  { value: 'completed', label: statusLabels.completed },
  { value: 'overdue', label: statusLabels.overdue },
];

export function ReportsTab({
  courses,
  users,
  positions,
  departments,
  onSyncRequired,
  syncing,
}: {
  courses: Course[];
  users: User[];
  positions: Position[];
  departments: Department[];
  onSyncRequired: () => void;
  syncing: boolean;
}) {
  const [courseFilter, setCourseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [search, setSearch] = useState('');

  const rowsQuery = useQuery({
    queryKey: queryKeys.academyOpus.learnerRows,
    queryFn: academyOpusApi.getLearnerRows,
  });

  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const courseById = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses]);

  /** Отдел человека — через его должность. */
  const departmentOfUser = useMemo(() => {
    const departmentByPosition = new Map(
      positions.map((position) => [position.id, position.departmentId]),
    );
    return (user: User | undefined) => {
      const positionId = user?.positionIds[0];
      return positionId ? departmentByPosition.get(positionId) : undefined;
    };
  }, [positions]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return (rowsQuery.data ?? []).filter((row) => {
      if (courseFilter !== 'all' && row.courseId !== courseFilter) return false;
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;

      const user = userById.get(row.userId);
      if (departmentFilter !== 'all' && departmentOfUser(user) !== departmentFilter) return false;

      if (query) {
        const haystack = `${fullName(user)} ${courseById.get(row.courseId)?.title ?? ''}`;
        if (!haystack.toLowerCase().includes(query)) return false;
      }
      return true;
    });
  }, [
    courseById,
    courseFilter,
    departmentFilter,
    departmentOfUser,
    rowsQuery.data,
    search,
    statusFilter,
    userById,
  ]);

  const summary = useMemo(() => summarize(filtered), [filtered]);

  function exportCsv() {
    const header = [
      'Сотрудник',
      'Отдел',
      'Курс',
      'Статус',
      'Прогресс, %',
      'Уроков пройдено',
      'Уроков всего',
      'Лучший балл',
      'Назначен',
      'Дедлайн',
      'Завершён',
      'Источник',
    ];

    const rows = filtered.map((row) => {
      const user = userById.get(row.userId);
      const departmentId = departmentOfUser(user);
      return [
        fullName(user),
        departments.find((item) => item.id === departmentId)?.name ?? '',
        courseById.get(row.courseId)?.title ?? '',
        statusLabels[row.status],
        row.percent,
        row.completedLessons,
        row.totalLessons,
        row.bestScore ?? '',
        formatDate(row.assignedAt),
        row.dueDate ? formatDate(row.dueDate) : '',
        row.completedAt ? formatDate(row.completedAt) : '',
        viaLabels[row.via],
      ];
    });

    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`academy-progress-${stamp}.csv`, [header, ...rows]);
  }

  if (rowsQuery.isError) {
    return <ErrorState onRetry={() => void rowsQuery.refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryTile label="Назначено" value={summary.assigned} icon={Users} />
        <SummaryTile label="Не начали" value={summary.notStarted} tone="neutral" />
        <SummaryTile label="В процессе" value={summary.inProgress} tone="primary" />
        <SummaryTile label="Завершили" value={summary.completed} tone="success" />
        <SummaryTile label="Просрочено" value={summary.overdue} tone="danger" />
      </div>

      <div className="rounded-lg border border-slate-200 bg-surface shadow-card">
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4">
          <Input
            label="Поиск"
            placeholder="Сотрудник или курс"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="min-w-52 flex-1"
          />
          <Select
            label="Курс"
            className="min-w-52"
            value={courseFilter}
            onValueChange={setCourseFilter}
            options={[
              { value: 'all', label: 'Все курсы' },
              ...courses.map((course) => ({ value: course.id, label: course.title })),
            ]}
          />
          <Select
            label="Статус"
            className="min-w-44"
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={statusOptions}
          />
          <Select
            label="Отдел"
            className="min-w-44"
            value={departmentFilter}
            onValueChange={setDepartmentFilter}
            options={[
              { value: 'all', label: 'Все отделы' },
              ...departments.map((department) => ({
                value: department.id,
                label: department.name,
              })),
            ]}
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onSyncRequired} loading={syncing}>
              <RefreshCw className="size-4" />
              Досоздать по должностям
            </Button>
            <Button variant="secondary" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="size-4" />
              CSV
            </Button>
          </div>
        </div>

        {rowsQuery.isPending ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="h-10 animate-pulse rounded bg-slate-200/60" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={BarChart3}
              title="Нет строк под фильтры"
              description="Измените фильтры или назначьте курс сотрудникам."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-slate-100 text-xs tracking-wide text-slate-400 uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">Сотрудник</th>
                  <th className="px-4 py-3 font-semibold">Курс</th>
                  <th className="px-4 py-3 font-semibold">Статус</th>
                  <th className="px-4 py-3 font-semibold">Прогресс</th>
                  <th className="px-4 py-3 font-semibold">Балл</th>
                  <th className="px-4 py-3 font-semibold">Дедлайн</th>
                  <th className="px-4 py-3 font-semibold">Источник</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((row) => {
                  const user = userById.get(row.userId);
                  return (
                    <tr key={`${row.userId}-${row.courseId}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-900">{fullName(user)}</span>
                        {row.pendingReview && (
                          <Badge variant="warning" className="ml-2">
                            <AlertTriangle className="size-3" />
                            На проверке
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {courseById.get(row.courseId)?.title ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status as CourseProgressStatus} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ProgressBar percent={row.percent} className="w-24" />
                          <span className="text-xs text-slate-500">
                            {row.completedLessons}/{row.totalLessons}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {row.bestScore === undefined ? '—' : `${row.bestScore}%`}
                      </td>
                      <td className="px-4 py-3">
                        <DueDateLabel dueDate={row.dueDate} />
                      </td>
                      <td className="px-4 py-3 text-slate-500">{viaLabels[row.via]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone = 'neutral',
  icon: Icon,
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'primary' | 'success' | 'danger';
  icon?: typeof Users;
}) {
  const toneClasses = {
    neutral: 'text-slate-900',
    primary: 'text-primary-600',
    success: 'text-success-700',
    danger: 'text-danger-600',
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-surface p-4 shadow-card">
      <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
        {Icon && <Icon className="size-4" />}
        {label}
      </div>
      <p className={`mt-2 text-2xl font-bold ${toneClasses[tone]}`}>{value}</p>
    </div>
  );
}
