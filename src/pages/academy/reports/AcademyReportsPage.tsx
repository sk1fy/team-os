import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useTitle } from '@reactuses/core';
import { Download } from 'lucide-react';
import { academyReportsApi } from '@/api/academy';
import { API_URL } from '@/api/config';
import { queryKeys } from '@/api/queryKeys';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { Button, Input, Select } from '@/components/ui';
import {
  academyRoutes,
  parseReportFilters,
  reportFiltersToSearchParams,
  reportRowStatusLabel,
} from '@/lib/academy';
import { StatusBadgeFromPresentation } from '../components/StatusBadge';
import { BarChart3 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';

/**
 * Internal reports from server read model — no client-side joins of all entities.
 * Filters/page/sort live in the URL.
 */
export function AcademyReportsPage() {
  useTitle('Отчёты — Академия — TeamOS');
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseReportFilters(searchParams), [searchParams]);

  const reportQuery = useQuery({
    queryKey: queryKeys.academyV2.internalReport(filters),
    queryFn: ({ signal }) => academyReportsApi.internal(filters, { signal }),
  });

  const setFilter = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!value || value === 'all') next.delete(key);
      else next.set(key, value);
      if (key !== 'page') next.delete('page');
      return next;
    });
  };

  const downloadCsv = async () => {
    const path = academyReportsApi.internalCsvPath(filters);
    const token = useAuthStore.getState().accessToken;
    const response = await fetch(`${API_URL}${path}`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) throw new Error('export failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'academy-internal-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Отчёты"
        description="Готовый server read model: not started, in progress, completed, overdue. Без загрузки всех сущностей на клиент."
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void downloadCsv().catch(() => undefined)}
          >
            <Download className="size-4" />
            CSV
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          label="Поиск"
          value={filters.q ?? ''}
          onChange={(e) => setFilter('q', e.target.value)}
          placeholder="ФИО или курс"
        />
        <Input
          label="Курс ID"
          value={filters.courseId ?? ''}
          onChange={(e) => setFilter('courseId', e.target.value)}
          placeholder="опционально"
        />
        <Select
          label="Статус"
          value={filters.status ?? 'all'}
          onValueChange={(value) => setFilter('status', value)}
          options={[
            { value: 'all', label: 'Все' },
            { value: 'not_started', label: 'Не начат' },
            { value: 'in_progress', label: 'В процессе' },
            { value: 'completed', label: 'Завершён' },
            { value: 'overdue', label: 'Просрочен' },
            { value: 'frozen', label: 'Заморожен' },
          ]}
        />
        <Select
          label="Сортировка"
          value={filters.sort ?? 'status'}
          onValueChange={(value) => setFilter('sort', value)}
          options={[
            { value: 'status', label: 'По статусу' },
            { value: 'deadline_asc', label: 'По дедлайну' },
            { value: 'name_asc', label: 'По имени' },
          ]}
        />
      </div>

      {reportQuery.isError ? (
        <ErrorState
          title="Не удалось загрузить отчёт"
          description="Нужен backend read model GET /academy/v2/reports/internal"
          onRetry={() => void reportQuery.refetch()}
        />
      ) : reportQuery.isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
      ) : (reportQuery.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Нет строк"
          description="Измените фильтры или назначьте курсы сотрудникам."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-surface">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Сотрудник</th>
                  <th className="px-3 py-2">Курс</th>
                  <th className="px-3 py-2">Статус</th>
                  <th className="px-3 py-2">Прогресс</th>
                  <th className="px-3 py-2">Дедлайн</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {reportQuery.data!.items.map((row, index) => (
                  <tr key={`${row.userId}-${row.courseId}-${index}`} className="border-b border-slate-100">
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{row.userName}</div>
                      <div className="text-xs text-slate-500">
                        {[row.departmentName, row.positionName].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{row.courseTitle}</td>
                    <td className="px-3 py-2">
                      <StatusBadgeFromPresentation status={reportRowStatusLabel(row.status)} />
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {row.percent}% · {row.completedLessons}/{row.totalLessons}
                    </td>
                    <td className="px-3 py-2 text-slate-500">
                      {row.dueDate ? new Date(row.dueDate).toLocaleDateString('ru-RU') : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {row.enrollmentId ? (
                        <Link
                          to={academyRoutes.enrollmentReport(row.enrollmentId)}
                          className="text-sm font-medium text-primary-600 hover:underline"
                        >
                          Отчёт
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>
              Стр. {reportQuery.data!.page} из {reportQuery.data!.totalPages} · всего{' '}
              {reportQuery.data!.total}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={reportQuery.data!.page <= 1}
                onClick={() =>
                  setSearchParams(
                    reportFiltersToSearchParams({
                      ...filters,
                      page: (filters.page ?? 1) - 1,
                    }),
                  )
                }
              >
                Назад
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={reportQuery.data!.page >= reportQuery.data!.totalPages}
                onClick={() =>
                  setSearchParams(
                    reportFiltersToSearchParams({
                      ...filters,
                      page: (filters.page ?? 1) + 1,
                    }),
                  )
                }
              >
                Вперёд
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
