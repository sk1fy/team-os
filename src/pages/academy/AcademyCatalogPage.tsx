import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTitle } from '@reactuses/core';
import { BookOpen } from 'lucide-react';
import { academyLearningApi } from '@/api/academy';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { Button, Input } from '@/components/ui';
import { academyRoutes } from '@/lib/academy';
import { toast } from '@/stores/toast';

export function AcademyCatalogPage() {
  useTitle('Каталог — Академия — TeamOS');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const q = searchParams.get('q') ?? '';
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  const filters = useMemo(() => ({ q: q || undefined, page: 1, pageSize: 24 }), [q]);

  const catalogQuery = useQuery({
    queryKey: queryKeys.academyV2.catalog(filters),
    queryFn: ({ signal }) => academyLearningApi.catalog(filters, { signal }),
  });

  const enroll = useMutation({
    mutationFn: (courseId: string) => academyLearningApi.enrollFromCatalog(courseId),
    onSuccess: (enrollment) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.myLearning });
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.catalog(filters) });
      toast.success('Курс добавлен в обучение');
      navigate(academyRoutes.learn(enrollment.id));
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Не удалось записаться на курс');
    },
    onSettled: () => setEnrollingId(null),
  });

  if (catalogQuery.isError) {
    return (
      <ErrorState
        title="Не удалось загрузить каталог"
        description="Попробуйте обновить страницу."
        onRetry={() => void catalogQuery.refetch()}
      />
    );
  }

  const items = catalogQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Каталог компании"
        description="Доступные курсы компании. Начните обучение — откроется enrollment player."
      />

      <div className="max-w-md">
        <Input
          value={q}
          onChange={(e) => {
            const next = e.target.value;
            setSearchParams((prev) => {
              const params = new URLSearchParams(prev);
              if (next) params.set('q', next);
              else params.delete('q');
              return params;
            });
          }}
          placeholder="Поиск курса…"
          aria-label="Поиск по каталогу"
        />
      </div>

      {catalogQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Курсы не найдены"
          description={
            q ? 'Измените поисковый запрос.' : 'В каталоге пока нет опубликованных курсов.'
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((course) => (
            <article
              key={course.id}
              className="flex flex-col rounded-xl border border-slate-200 bg-surface p-4 shadow-sm"
            >
              <h3 className="text-base font-semibold text-slate-900">{course.title}</h3>
              {course.description ? (
                <p className="mt-2 line-clamp-3 text-sm text-slate-500">{course.description}</p>
              ) : null}
              <p className="mt-3 text-xs text-slate-500">
                {course.lessonCount} уроков
                {course.latestVersionNumber != null
                  ? ` · версия ${course.latestVersionNumber}`
                  : null}
              </p>
              <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                {course.enrolled && course.enrollmentId ? (
                  <>
                    <span className="text-sm text-slate-600">
                      Прогресс {course.progressPercent ?? 0}%
                    </span>
                    <Link to={academyRoutes.learn(course.enrollmentId)}>
                      <Button size="sm">Продолжить</Button>
                    </Link>
                  </>
                ) : (
                  <Button
                    size="sm"
                    className="ml-auto"
                    loading={enrollingId === course.id && enroll.isPending}
                    onClick={() => {
                      setEnrollingId(course.id);
                      enroll.mutate(course.id);
                    }}
                  >
                    Начать обучение
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
