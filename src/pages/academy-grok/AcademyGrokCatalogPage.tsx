import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { Plus, Search } from 'lucide-react';
import { academyApi, authApi } from '@/api';
import { queryKeys } from '@/api/queryKeys';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { Button, Select } from '@/components/ui';
import { canManageContent } from '@/lib/permissions';
import { AcademyGrokNav } from './components/AcademyGrokNav';
import { GrokCourseCard } from './components/GrokCourseCard';
import { CreateCourseModal } from './CreateCourseModal';
import { userProgressFor } from './utils';
import type { Course } from '@/types';

const emptyCourses: Course[] = [];
const emptyLessons: never[] = [];
const emptyProgress: never[] = [];

export function AcademyGrokCatalogPage() {
  useTitle('Каталог — Академия Grok — TeamOS');
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Course['status'] | 'my'>('all');
  const [createOpen, setCreateOpen] = useState(false);

  const currentUserQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: authApi.getCurrentUser,
  });
  const coursesQuery = useQuery({
    queryKey: queryKeys.academy.courses,
    queryFn: academyApi.getCourses,
  });
  const lessonsQuery = useQuery({
    queryKey: queryKeys.academy.lessonsFor('all'),
    queryFn: () => academyApi.getLessons(),
  });
  const progressQuery = useQuery({
    queryKey: queryKeys.academy.progress,
    queryFn: () => academyApi.getProgress(),
  });

  const currentUser = currentUserQuery.data;
  const canManage = canManageContent(currentUser?.role);
  const courses = coursesQuery.data ?? emptyCourses;
  const lessons = lessonsQuery.data ?? emptyLessons;
  const progress = progressQuery.data ?? emptyProgress;

  const visibleCourses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return courses.filter((course) => {
      if (!canManage && course.status === 'draft') return false;
      if (statusFilter === 'published' || statusFilter === 'draft') {
        if (course.status !== statusFilter) return false;
      }
      if (statusFilter === 'my') {
        const item = userProgressFor(progress, currentUser?.id, course.id);
        if (!item) return false;
      }
      if (!query) return true;
      return (
        course.title.toLowerCase().includes(query) ||
        (course.description ?? '').toLowerCase().includes(query)
      );
    });
  }, [canManage, courses, currentUser?.id, progress, search, statusFilter]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <PageHeader
        title="Каталог курсов"
        description="Все доступные материалы компании. Фильтруйте, ищите и открывайте программу курса."
        actions={
          canManage ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Новый курс
            </Button>
          ) : undefined
        }
      />
      <AcademyGrokNav canManage={canManage} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Поиск по названию или описанию…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-9.5 w-full rounded-md border border-slate-200 bg-surface pr-3 pl-9 text-sm transition-colors focus:outline-2 focus:-outline-offset-1 focus:outline-primary-600"
          />
        </div>
        <Select
          className="w-48"
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}
          options={[
            { value: 'all', label: 'Все курсы' },
            { value: 'my', label: 'С моим прогрессом' },
            { value: 'published', label: 'Опубликованные' },
            ...(canManage ? [{ value: 'draft' as const, label: 'Черновики' }] : []),
          ]}
        />
        <p className="text-sm text-slate-500">
          Найдено: {visibleCourses.length}
        </p>
      </div>

      {coursesQuery.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-64 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
            />
          ))}
        </div>
      ) : visibleCourses.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleCourses.map((course) => (
            <GrokCourseCard
              key={course.id}
              course={course}
              lessons={lessons}
              progress={userProgressFor(progress, currentUser?.id, course.id)}
              showAdminBadges={canManage}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Search}
          title={courses.length === 0 ? 'Курсов пока нет' : 'Ничего не найдено'}
          description={
            courses.length === 0
              ? canManage
                ? 'Создайте первый курс — он появится в каталоге и в «Моём обучении».'
                : 'Когда администратор опубликует курсы, они появятся здесь.'
              : 'Измените запрос или сбросьте фильтр.'
          }
          action={
            canManage && courses.length === 0 ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                Создать курс
              </Button>
            ) : undefined
          }
        />
      )}

      {canManage && (
        <CreateCourseModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={(course) => {
            setCreateOpen(false);
            navigate(`/academy-grok/courses/${course.id}`);
          }}
        />
      )}
    </div>
  );
}
