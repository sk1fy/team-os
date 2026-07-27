import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTitle } from '@reactuses/core';
import { Building2 } from 'lucide-react';
import { authApi } from '@/api';
import { academyCoursesApi } from '@/api/academy';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { Button, Input, Modal } from '@/components/ui';
import {
  academyRoutes,
  distributionStatusLabel,
  lifecycleStatusLabel,
  resolveCourseCapabilities,
} from '@/lib/academy';
import { toast } from '@/stores/toast';
import { plural } from '@/lib/format';
import { createId } from '@/lib/id';
import { StatusBadgeFromPresentation } from '../components/StatusBadge';

/**
 * Owner/admin oversight of partner courses — read-only originals,
 * copy / pause / block via capabilities.
 */
export function AcademyPartnerCoursesPage() {
  useTitle('Курсы партнёров — Академия — TeamOS');
  const queryClient = useQueryClient();
  const [restriction, setRestriction] = useState<{
    courseId: string;
    action: 'pause' | 'block' | 'resolve';
  } | null>(null);
  const [restrictionReason, setRestrictionReason] = useState('');

  const coursesQuery = useQuery({
    queryKey: queryKeys.academyV2.courses({ ownerType: 'partner', pageSize: 100 }),
    queryFn: ({ signal }) =>
      academyCoursesApi.list({ ownerType: 'partner', pageSize: 100 }, { signal }),
  });
  const userQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: authApi.getCurrentUser,
  });

  const copy = useMutation({
    mutationFn: (input: { courseId: string; versionId: string }) =>
      academyCoursesApi.copyToCompany(
        input.courseId,
        { versionId: input.versionId },
        { idempotencyKey: createId() },
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
      setRestriction(null);
      setRestrictionReason('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.coursesRoot });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Ошибка'),
  });

  const block = useMutation({
    mutationFn: (input: { courseId: string; reason: string }) =>
      academyCoursesApi.block(input.courseId, { reason: input.reason }),
    onSuccess: () => {
      toast.success('Курс заблокирован');
      setRestriction(null);
      setRestrictionReason('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.coursesRoot });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Ошибка'),
  });

  const resolveRestriction = useMutation({
    mutationFn: (input: { courseId: string; reason: string }) =>
      academyCoursesApi.resolveRestriction(input.courseId, { reason: input.reason }),
    onSuccess: () => {
      toast.success('Ограничение снято');
      setRestriction(null);
      setRestrictionReason('');
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
          description="Добавьте пользователя с ролью партнёра. После публикации его курсы появятся здесь для контроля и копирования."
          action={
            <Link to="/employees?role=partner&addUser=1">
              <Button>Добавить партнёра</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-8">
          {[...groups.entries()].map(([partnerKey, courses]) => (
            <section key={partnerKey} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Building2 className="size-4 shrink-0 text-slate-400" aria-hidden />
                <h2 className="text-sm font-semibold text-slate-800">
                  {courses[0]?.ownerDisplayName ?? 'Партнёр'}
                </h2>
                {courses[0]?.ownerDisplayName ? null : (
                  <span
                    className="max-w-[14rem] truncate rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-500"
                    title={partnerKey}
                  >
                    {partnerKey}
                  </span>
                )}
                <span className="text-xs text-slate-400">
                  {courses.length} {plural(courses.length, ['курс', 'курса', 'курсов'])}
                </span>
              </div>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-surface shadow-card">
                {courses.map((course) => {
                  const capabilities = userQuery.data
                    ? resolveCourseCapabilities({
                        role: userQuery.data.role,
                        userId: userQuery.data.id,
                        course,
                      })
                    : null;

                  return (
                    <li
                      key={course.id}
                      className="flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <Link
                          to={academyRoutes.course(course.id)}
                          className="font-medium text-slate-900 underline-offset-2 hover:text-primary-700 hover:underline"
                        >
                          {course.title}
                        </Link>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <StatusBadgeFromPresentation
                            status={lifecycleStatusLabel(course.lifecycleStatus)}
                          />
                          <StatusBadgeFromPresentation
                            status={distributionStatusLabel(course.distributionStatus)}
                          />
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {course.latestPublishedVersion ? (
                          <Link to={academyRoutes.previewVersion(course.latestPublishedVersion.id)}>
                            <Button size="sm" variant="secondary">
                              Предпросмотр
                            </Button>
                          </Link>
                        ) : null}
                        {capabilities?.canCopyToCompany && course.latestPublishedVersion ? (
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
                        {capabilities?.canPauseDistribution ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={pause.isPending}
                            onClick={() => {
                              setRestriction({ courseId: course.id, action: 'pause' });
                              setRestrictionReason('');
                            }}
                          >
                            Пауза
                          </Button>
                        ) : null}
                        {capabilities?.canBlock ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="border-danger-500/30 text-danger-600 hover:border-danger-500/50 hover:bg-danger-50 hover:text-danger-700"
                            loading={block.isPending}
                            onClick={() => {
                              setRestriction({ courseId: course.id, action: 'block' });
                              setRestrictionReason('');
                            }}
                          >
                            Блок
                          </Button>
                        ) : null}
                        {capabilities?.canResolveRestriction &&
                        course.distributionStatus !== 'active' ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={resolveRestriction.isPending}
                            onClick={() => {
                              setRestriction({ courseId: course.id, action: 'resolve' });
                              setRestrictionReason('');
                            }}
                          >
                            Снять ограничение
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Modal
        open={restriction != null}
        onOpenChange={(open) => {
          if (!open) {
            setRestriction(null);
            setRestrictionReason('');
          }
        }}
        title={
          restriction?.action === 'block'
            ? 'Заблокировать курс'
            : restriction?.action === 'resolve'
              ? 'Снять ограничение'
              : 'Приостановить распространение'
        }
        description={
          restriction?.action === 'block'
            ? 'Экстренная блокировка остановит активные прохождения. Причина обязательна.'
            : restriction?.action === 'resolve'
              ? 'Укажите причину снятия pause/block. Backend требует обязательный reason.'
              : 'Новые активации будут остановлены до снятия ограничения.'
        }
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setRestriction(null);
                setRestrictionReason('');
              }}
            >
              Отмена
            </Button>
            <Button
              variant={restriction?.action === 'block' ? 'danger' : 'primary'}
              disabled={restrictionReason.trim().length < 3}
              loading={pause.isPending || block.isPending || resolveRestriction.isPending}
              onClick={() => {
                if (!restriction || restrictionReason.trim().length < 3) return;
                const input = {
                  courseId: restriction.courseId,
                  reason: restrictionReason.trim(),
                };
                if (restriction.action === 'block') block.mutate(input);
                else if (restriction.action === 'resolve') resolveRestriction.mutate(input);
                else pause.mutate(input);
              }}
            >
              {restriction?.action === 'block'
                ? 'Заблокировать'
                : restriction?.action === 'resolve'
                  ? 'Снять ограничение'
                  : 'Приостановить'}
            </Button>
          </>
        }
      >
        <Input
          label="Причина"
          value={restrictionReason}
          onChange={(event) => setRestrictionReason(event.target.value)}
          error={
            restrictionReason.length > 0 && restrictionReason.trim().length < 3
              ? 'Укажите причину не короче 3 символов'
              : undefined
          }
          placeholder="Что произошло"
        />
      </Modal>
    </div>
  );
}
