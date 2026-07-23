import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useTitle } from '@reactuses/core';
import { BarChart3, Download } from 'lucide-react';
import { academyReportsApi } from '@/api/academy';
import { authApi } from '@/api';
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
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { toast } from '@/stores/toast';
import { ApiError } from '@/api/client';

function externalProgressLabel(status: string): string {
  if (status === 'not_started') return 'Не начат';
  if (status === 'in_progress') return 'В процессе';
  if (status === 'completed') return 'Завершён';
  return status;
}

function externalAccessLabel(status: string): string {
  if (status === 'invited') return 'Приглашён';
  if (status === 'ready') return 'Готов к старту';
  if (status === 'active') return 'Активен';
  if (status === 'expired') return 'Срок истёк';
  if (status === 'frozen') return 'Заморожен';
  if (status === 'suspended') return 'Приостановлен';
  if (status === 'revoked') return 'Отозван';
  if (status === 'closed') return 'Закрыт';
  return status;
}

function isUuid(value: string | undefined): boolean {
  if (!value) return true;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/**
 * Role-aware reports:
 * - owner/admin → internal employee report
 * - partner → external own-courses report (never reports/internal)
 */
export function AcademyReportsPage() {
  useTitle('Отчёты — Академия — TeamOS');
  const [searchParams, setSearchParams] = useSearchParams();
  const [isDownloading, setIsDownloading] = useState(false);
  const downloadControllerRef = useRef<AbortController | null>(null);
  const filters = useMemo(() => parseReportFilters(searchParams), [searchParams]);
  const debouncedQuery = useDebouncedValue(filters.q ?? '');
  const serverFilters = useMemo(
    () => ({ ...filters, q: debouncedQuery || undefined }),
    [debouncedQuery, filters],
  );
  const invalidIds = {
    courseId: !isUuid(filters.courseId),
    departmentId: !isUuid(filters.departmentId),
    positionId: !isUuid(filters.positionId),
  };
  const hasInvalidId = Object.values(invalidIds).some(Boolean);

  const userQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: authApi.getCurrentUser,
  });

  const role = userQuery.data?.role;
  const isPartner = role === 'partner';
  const isManager = role === 'owner' || role === 'admin';

  const internalQuery = useQuery({
    queryKey: queryKeys.academyV2.internalReport(serverFilters),
    queryFn: ({ signal }) => academyReportsApi.internal(serverFilters, { signal }),
    enabled: isManager && !hasInvalidId,
  });

  const partnerQuery = useQuery({
    queryKey: queryKeys.academyV2.partnerExternalReport(serverFilters),
    queryFn: ({ signal }) =>
      academyReportsApi.partnerExternal(
        {
          q: serverFilters.q,
          courseId: filters.courseId,
          page: filters.page,
          pageSize: filters.pageSize,
        },
        { signal },
      ),
    enabled: isPartner && !invalidIds.courseId,
  });

  useEffect(
    () => () => {
      downloadControllerRef.current?.abort();
    },
    [],
  );

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
    if (!isManager) return;
    downloadControllerRef.current?.abort();
    const controller = new AbortController();
    downloadControllerRef.current = controller;
    setIsDownloading(true);
    try {
      const blob = await academyReportsApi.internalCsv(filters, { signal: controller.signal });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'academy-internal-report.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      if (!controller.signal.aborted) {
        toast.error(error instanceof ApiError ? error.message : 'Не удалось выгрузить CSV');
      }
    } finally {
      if (downloadControllerRef.current === controller) {
        downloadControllerRef.current = null;
        setIsDownloading(false);
      }
    }
  };

  const pageSummary = useMemo(() => {
    const counts = {
      not_started: 0,
      in_progress: 0,
      completed: 0,
      overdue: 0,
      frozen: 0,
    };
    for (const row of internalQuery.data?.items ?? []) counts[row.status] += 1;
    return counts;
  }, [internalQuery.data?.items]);

  if (userQuery.isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-slate-100" />;
  }

  if (role === 'employee') {
    return (
      <ErrorState
        title="Недостаточно прав"
        description="Отчёты команды доступны владельцу, администратору и партнёру (только свои курсы)."
      />
    );
  }

  if (isPartner) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Отчёты"
          description="Внешние прохождения по вашим курсам. Backend ограничивает scope — внутренних сотрудников здесь нет."
        />
        <Input
          label="Поиск"
          value={filters.q ?? ''}
          onChange={(e) => setFilter('q', e.target.value)}
          placeholder="Email или курс"
          className="max-w-md"
        />
        {partnerQuery.isError ? (
          <ErrorState
            title="Не удалось загрузить отчёт"
            description="Нужен backend GET /academy/reports/external (partner-scoped)."
            onRetry={() => void partnerQuery.refetch()}
          />
        ) : partnerQuery.isLoading ? (
          <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
        ) : (partnerQuery.data?.items.length ?? 0) === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="Нет данных"
            description="Когда внешние ученики пройдут ваши курсы, строки появятся здесь."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-surface">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Ученик</th>
                  <th className="px-3 py-2">Курс</th>
                  <th className="px-3 py-2">Статус</th>
                  <th className="px-3 py-2">Прогресс</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {partnerQuery.data!.items.map((row) => (
                  <tr key={row.enrollmentId} className="border-b border-slate-100">
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">
                        {row.learnerName ?? row.learnerEmail}
                      </div>
                      <div className="text-xs text-slate-500">{row.learnerEmail}</div>
                    </td>
                    <td className="px-3 py-2">{row.courseTitle}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {externalProgressLabel(row.progressStatus)} ·{' '}
                      {externalAccessLabel(row.accessStatus)}
                    </td>
                    <td className="px-3 py-2">{row.percent}%</td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        to={academyRoutes.enrollmentReport(row.enrollmentId)}
                        className="text-sm font-medium text-primary-600 hover:underline"
                      >
                        Отчёт
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // owner / admin
  return (
    <div className="space-y-6">
      <PageHeader
        title="Отчёты"
        description="Готовый server read model по назначениям сотрудников (включая not started)."
        actions={
          <Button
            variant="secondary"
            size="sm"
            loading={isDownloading}
            onClick={() => void downloadCsv()}
          >
            <Download className="size-4" />
            CSV
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
          error={invalidIds.courseId ? 'Введите полный UUID' : undefined}
        />
        <Input
          label="Отдел ID"
          value={filters.departmentId ?? ''}
          onChange={(e) => setFilter('departmentId', e.target.value)}
          placeholder="опционально"
          error={invalidIds.departmentId ? 'Введите полный UUID' : undefined}
        />
        <Input
          label="Должность ID"
          value={filters.positionId ?? ''}
          onChange={(e) => setFilter('positionId', e.target.value)}
          placeholder="опционально"
          error={invalidIds.positionId ? 'Введите полный UUID' : undefined}
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
            { value: 'title_asc', label: 'По курсу' },
          ]}
        />
      </div>

      {internalQuery.data ? (
        <section aria-label="Сводка текущей страницы" className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            На текущей странице
          </p>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ['Не начали', pageSummary.not_started],
              ['В процессе', pageSummary.in_progress],
              ['Завершили', pageSummary.completed],
              ['Просрочили', pageSummary.overdue],
              ['Заморожены', pageSummary.frozen],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-surface p-3">
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="mt-1 text-xl font-semibold text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {internalQuery.isError ? (
        <ErrorState
          title="Не удалось загрузить отчёт"
          description="Нужен backend read model GET /academy/reports/internal"
          onRetry={() => void internalQuery.refetch()}
        />
      ) : internalQuery.isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
      ) : (internalQuery.data?.items.length ?? 0) === 0 ? (
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
                {internalQuery.data!.items.map((row, index) => (
                  <tr
                    key={`${row.userId}-${row.courseId}-${index}`}
                    className="border-b border-slate-100"
                  >
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
              Стр. {internalQuery.data!.page} из {internalQuery.data!.totalPages} · всего{' '}
              {internalQuery.data!.total}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={internalQuery.data!.page <= 1}
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
                disabled={internalQuery.data!.page >= internalQuery.data!.totalPages}
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
