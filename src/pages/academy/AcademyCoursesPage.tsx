import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useTitle } from '@reactuses/core';
import { Library, Plus } from 'lucide-react';
import { academyCoursesApi } from '@/api/academy';
import { authApi } from '@/api';
import { queryKeys } from '@/api/queryKeys';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { Badge, Button, Input, Select } from '@/components/ui';
import {
  academyRoutes,
  canManageAcademyCourses,
  distributionStatusLabel,
  lifecycleStatusLabel,
} from '@/lib/academy';
import { StatusBadgeFromPresentation } from './components/StatusBadge';
import { CreateCourseModal } from './CreateCourseModal';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import type { AcademyListFilters } from '@/types/academy';

export function AcademyCoursesPage() {
  useTitle('Курсы — Академия — TeamOS');
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const lifecycleStatus = searchParams.get('lifecycle') ?? 'all';
  const distributionStatus = searchParams.get('distribution') ?? 'all';
  const debouncedQ = useDebouncedValue(q);
  const requestedPage = Number(searchParams.get('page') ?? '1');
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setCreateOpen(true);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('create');
          return next;
        },
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams]);

  const userQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: authApi.getCurrentUser,
  });
  const isPartner = userQuery.data?.role === 'partner';

  const filters = useMemo<AcademyListFilters>(
    () => ({
      q: debouncedQ || undefined,
      ownerType: isPartner ? ('partner' as const) : ('company' as const),
      lifecycleStatus:
        lifecycleStatus === 'active' ||
        lifecycleStatus === 'archived' ||
        lifecycleStatus === 'deleted'
          ? lifecycleStatus
          : ('all' as const),
      distributionStatus:
        distributionStatus === 'active' ||
        distributionStatus === 'paused' ||
        distributionStatus === 'blocked'
          ? distributionStatus
          : ('all' as const),
      page,
      pageSize: 30,
      sort: 'updated_desc' as const,
    }),
    [debouncedQ, distributionStatus, isPartner, lifecycleStatus, page],
  );

  const setFilter = (key: 'lifecycle' | 'distribution', value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === 'all') next.delete(key);
      else next.set(key, value);
      next.delete('page');
      return next;
    });
  };

  const coursesQuery = useQuery({
    queryKey: queryKeys.academyV2.courses(filters),
    queryFn: ({ signal }) => academyCoursesApi.list(filters, { signal }),
    enabled: canManageAcademyCourses(userQuery.data?.role),
  });

  const title = isPartner ? 'Мои курсы' : 'Курсы компании';

  if (userQuery.data && !canManageAcademyCourses(userQuery.data.role)) {
    return (
      <ErrorState
        title="Недостаточно прав"
        description="Управление курсами доступно владельцу, администратору и партнёру."
      />
    );
  }

  if (coursesQuery.isError) {
    return (
      <ErrorState
        title="Не удалось загрузить курсы"
        onRetry={() => void coursesQuery.refetch()}
      />
    );
  }

  const items = coursesQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={
          isPartner
            ? 'Собственные курсы: черновики, публикации, внешние ссылки и отчёты.'
            : 'Курсы компании: конструктор, назначения, версии и отчёты.'
        }
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Создать курс
          </Button>
        }
      />

      <div className="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_13rem_13rem]">
        <Input
          value={q}
          onChange={(e) => {
            const next = e.target.value;
            setSearchParams((prev) => {
              const params = new URLSearchParams(prev);
              if (next) params.set('q', next);
              else params.delete('q');
              params.delete('page');
              return params;
            });
          }}
          placeholder="Поиск по названию…"
          aria-label="Поиск курсов"
        />
        <Select
          label="Состояние курса"
          value={lifecycleStatus}
          onValueChange={(value) => setFilter('lifecycle', value)}
          options={[
            { value: 'all', label: 'Все состояния' },
            { value: 'active', label: 'Активные' },
            { value: 'archived', label: 'В архиве' },
            { value: 'deleted', label: 'Удалённые' },
          ]}
        />
        <Select
          label="Распространение"
          value={distributionStatus}
          onValueChange={(value) => setFilter('distribution', value)}
          options={[
            { value: 'all', label: 'Любое распространение' },
            { value: 'active', label: 'Активно' },
            { value: 'paused', label: 'На паузе' },
            { value: 'blocked', label: 'Заблокировано' },
          ]}
        />
      </div>

      {coursesQuery.isLoading || userQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Library}
          title="Курсов пока нет"
          description="Создайте первый курс или возьмите системный шаблон."
          action={
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setCreateOpen(true)}>Создать курс</Button>
              <Link to={academyRoutes.templates}>
                <Button variant="secondary">Шаблоны</Button>
              </Link>
            </div>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-surface">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Курс</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Распространение</th>
                <th className="px-4 py-3">Версия</th>
                <th className="px-4 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map((course) => (
                <tr key={course.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      to={academyRoutes.course(course.id)}
                      className="font-medium text-slate-900 hover:text-primary-700"
                    >
                      {course.title}
                    </Link>
                    {course.origin?.sourceCourseTitle ? (
                      <p className="mt-0.5 text-xs text-slate-500">
                        Источник: {course.origin.sourceCourseTitle}
                      </p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge>
                        {course.ownerType === 'partner' ? 'Партнёр' : 'Компания'}
                      </Badge>
                      {course.draftVersion ? <Badge variant="warning">Есть черновик</Badge> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadgeFromPresentation
                      status={lifecycleStatusLabel(course.lifecycleStatus)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadgeFromPresentation
                      status={distributionStatusLabel(course.distributionStatus)}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {course.latestPublishedVersion
                      ? `v${course.latestPublishedVersion.versionNumber}`
                      : course.draftVersion
                        ? 'Черновик'
                        : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {course.capabilities.canEditDraft ? (
                        <Link to={academyRoutes.builder(course.id)}>
                          <Button size="sm" variant="ghost">Изменить</Button>
                        </Link>
                      ) : null}
                      {course.latestPublishedVersion ? (
                        <Link to={academyRoutes.previewVersion(course.latestPublishedVersion.id)}>
                          <Button size="sm" variant="ghost">Предпросмотр</Button>
                        </Link>
                      ) : null}
                      <Link to={academyRoutes.course(course.id)}>
                        <Button size="sm" variant="secondary">Открыть</Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {coursesQuery.data && coursesQuery.data.totalPages > 1 ? (
        <nav className="flex items-center justify-between gap-3" aria-label="Страницы списка курсов">
          <span className="text-sm text-slate-500">Страница {coursesQuery.data.page} из {coursesQuery.data.totalPages}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setSearchParams((prev) => { const next = new URLSearchParams(prev); if (page <= 2) next.delete('page'); else next.set('page', String(page - 1)); return next; })}>Назад</Button>
            <Button size="sm" variant="secondary" disabled={page >= coursesQuery.data.totalPages} onClick={() => setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set('page', String(page + 1)); return next; })}>Далее</Button>
          </div>
        </nav>
      ) : null}

      <CreateCourseModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        ownerType={isPartner ? 'partner' : 'company'}
      />
    </div>
  );
}
