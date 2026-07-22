import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTitle } from '@reactuses/core';
import { Building2 } from 'lucide-react';
import { academyCoursesApi } from '@/api/academy';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { Button } from '@/components/ui';
import {
  academyRoutes,
  distributionStatusLabel,
  lifecycleStatusLabel,
} from '@/lib/academy';
import { toast } from '@/stores/toast';
import { StatusBadgeFromPresentation } from '../components/StatusBadge';

/**
 * Owner/admin oversight of partner courses — read-only originals,
 * copy / pause / block via capabilities.
 */
export function AcademyPartnerCoursesPage() {
  useTitle('Курсы партнёров — Академия — TeamOS');
  const queryClient = useQueryClient();

  const coursesQuery = useQuery({
    queryKey: queryKeys.academyV2.courses({ ownerType: 'partner', pageSize: 100 }),
    queryFn: ({ signal }) =>
      academyCoursesApi.list({ ownerType: 'partner', pageSize: 100 }, { signal }),
  });

  const copy = useMutation({
    mutationFn: (input: { courseId: string; versionId: string }) =>
      academyCoursesApi.copyToCompany(
        input.courseId,
        { versionId: input.versionId },
        { idempotencyKey: crypto.randomUUID() },
      ),
    onSuccess: (course) => {
      toast.success('Копия создана как draft компании');
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.coursesRoot });
      window.location.assign(academyRoutes.builder(course.id));
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Не удалось скопировать'),
  });

  const pause = useMutation({
    mutationFn: (input: { courseId: string; reason: string }) =>
      academyCoursesApi.pauseDistribution(input.courseId, { reason: input.reason }),
    onSuccess: () => {
      toast.success('Распространение приостановлено');
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.coursesRoot });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Ошибка'),
  });

  const block = useMutation({
    mutationFn: (input: { courseId: string; reason: string }) =>
      academyCoursesApi.block(input.courseId, { reason: input.reason }),
    onSuccess: () => {
      toast.success('Курс заблокирован');
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.coursesRoot });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Ошибка'),
  });

  const resolveRestriction = useMutation({
    mutationFn: (courseId: string) => academyCoursesApi.resolveRestriction(courseId),
    onSuccess: () => {
      toast.success('Ограничение снято');
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.coursesRoot });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Ошибка'),
  });

  const items = coursesQuery.data?.items ?? [];

  // Group by partner
  const groups = new Map<string, typeof items>();
  for (const course of items) {
    const key = course.ownerUserId ?? course.ownerDisplayName ?? 'unknown';
    const list = groups.get(key) ?? [];
    list.push(course);
    groups.set(key, list);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Курсы партнёров"
        description="Read-only просмотр оригиналов. Можно копировать версию, приостанавливать и блокировать."
      />

      {coursesQuery.isError ? (
        <ErrorState onRetry={() => void coursesQuery.refetch()} />
      ) : coursesQuery.isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Партнёрских курсов нет"
          description="Когда партнёры опубликуют курсы, они появятся здесь."
        />
      ) : (
        <div className="space-y-8">
          {[...groups.entries()].map(([partnerKey, courses]) => (
            <section key={partnerKey} className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-800">
                {courses[0]?.ownerDisplayName ?? `Партнёр ${partnerKey}`}
              </h2>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-surface">
                {courses.map((course) => (
                  <li
                    key={course.id}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <Link
                        to={academyRoutes.course(course.id)}
                        className="font-medium text-slate-900 hover:text-primary-700"
                      >
                        {course.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <StatusBadgeFromPresentation
                          status={lifecycleStatusLabel(course.lifecycleStatus)}
                        />
                        <StatusBadgeFromPresentation
                          status={distributionStatusLabel(course.distributionStatus)}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {course.latestPublishedVersion ? (
                        <Link to={academyRoutes.previewVersion(course.latestPublishedVersion.id)}>
                          <Button size="sm" variant="secondary">
                            Preview
                          </Button>
                        </Link>
                      ) : null}
                      {course.capabilities.canCopyToCompany && course.latestPublishedVersion ? (
                        <Button
                          size="sm"
                          loading={copy.isPending}
                          onClick={() =>
                            copy.mutate({
                              courseId: course.id,
                              versionId: course.latestPublishedVersion!.id,
                            })
                          }
                        >
                          Копировать в компанию
                        </Button>
                      ) : null}
                      {course.capabilities.canPauseDistribution ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={pause.isPending}
                          onClick={() => {
                            const reason = window.prompt('Причина приостановки распространения:')?.trim();
                            if (reason) pause.mutate({ courseId: course.id, reason });
                          }}
                        >
                          Пауза
                        </Button>
                      ) : null}
                      {course.capabilities.canBlock ? (
                        <Button
                          size="sm"
                          variant="danger"
                          loading={block.isPending}
                          onClick={() => {
                            if (!window.confirm('Экстренная блокировка остановит активные прохождения. Продолжить?')) return;
                            const reason = window.prompt('Обязательная причина блокировки:')?.trim();
                            if (reason) block.mutate({ courseId: course.id, reason });
                          }}
                        >
                          Блок
                        </Button>
                      ) : null}
                      {course.capabilities.canResolveRestriction && course.distributionStatus !== 'active' ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={resolveRestriction.isPending}
                          onClick={() => resolveRestriction.mutate(course.id)}
                        >
                          Снять ограничение
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
