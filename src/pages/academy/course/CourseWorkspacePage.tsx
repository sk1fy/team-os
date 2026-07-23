import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTitle } from '@reactuses/core';
import {
  academyCoursesApi,
  academyDistributionApi,
  academyExternalAdminApi,
  academyVersionsApi,
} from '@/api/academy';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { PageHeader } from '@/components/layout/PageHeader';
import { ErrorState } from '@/components/layout/ErrorState';
import { Button, Input, Modal, Select } from '@/components/ui';
import {
  academyRoutes,
  distributionStatusLabel,
  lifecycleStatusLabel,
} from '@/lib/academy';
import { StatusBadgeFromPresentation } from '../components/StatusBadge';
import { AcademyStatusCallout } from '../components/AcademyStatusCallout';
import { toast } from '@/stores/toast';

const personalAccessStatusLabels = {
  issued: 'Ссылка выпущена',
  activated: 'Активирован',
  revoked: 'Отозван',
  closed: 'Закрыт',
} as const;

const campaignStatusLabels = {
  active: 'Активна',
  paused: 'На паузе',
  revoked: 'Отозвана',
  closed: 'Закрыта',
} as const;

const assignmentTargetLabels = {
  user: 'Сотрудник',
  position: 'Должность',
  department: 'Отдел',
} as const;

function parseDeadlineDays(value: string): number | null {
  const days = Number(value);
  return Number.isInteger(days) && days >= 1 && days <= 7 ? days : null;
}

export function CourseWorkspacePage() {
  const { courseId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [restriction, setRestriction] = useState<'pause' | 'block' | null>(null);
  const [restrictionReason, setRestrictionReason] = useState('');
  const [lifecycleConfirmation, setLifecycleConfirmation] = useState<
    'archive' | 'delete' | null
  >(null);
  useTitle('Курс — Академия — TeamOS');

  const courseQuery = useQuery({
    queryKey: queryKeys.academyV2.course(courseId),
    queryFn: ({ signal }) => academyCoursesApi.get(courseId, { signal }),
    enabled: Boolean(courseId),
  });

  const lifecycle = useMutation({
    mutationFn: async (action: 'archive' | 'restore' | 'delete' | 'resolve') => {
      if (action === 'archive') return academyCoursesApi.archive(courseId);
      if (action === 'restore') return academyCoursesApi.restore(courseId);
      if (action === 'resolve') return academyCoursesApi.resolveRestriction(courseId);
      await academyCoursesApi.delete(courseId);
      return null;
    },
    onSuccess: (_result, action) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.coursesRoot });
      if (action === 'delete') {
        toast.success('Курс удалён');
        navigate(academyRoutes.courses, { replace: true });
        return;
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.course(courseId) });
      toast.success(
        action === 'archive'
          ? 'Курс архивирован'
          : action === 'restore'
            ? 'Курс восстановлен'
            : 'Ограничение снято',
      );
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Не удалось изменить состояние курса'),
  });

  const copyPartnerCourse = useMutation({
    mutationFn: (input: { versionId: string; idempotencyKey: string }) =>
      academyCoursesApi.copyToCompany(
        courseId,
        { versionId: input.versionId },
        { idempotencyKey: input.idempotencyKey },
      ),
    onSuccess: (copy) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.coursesRoot });
      toast.success('Копия создана как черновик компании');
      navigate(academyRoutes.builder(copy.id));
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Не удалось скопировать курс'),
  });

  const restrictPartnerCourse = useMutation({
    mutationFn: (input: { action: 'pause' | 'block'; reason: string }) =>
      input.action === 'block'
        ? academyCoursesApi.block(courseId, { reason: input.reason })
        : academyCoursesApi.pauseDistribution(courseId, { reason: input.reason }),
    onSuccess: (_result, input) => {
      setRestriction(null);
      setRestrictionReason('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.course(courseId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.coursesRoot });
      toast.success(
        input.action === 'block'
          ? 'Курс заблокирован'
          : 'Распространение приостановлено',
      );
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Не удалось ограничить курс'),
  });

  if (courseQuery.isError) {
    const status = (courseQuery.error as { status?: number })?.status;
    if (status === 403) {
      return (
        <ErrorState
          title="Недостаточно прав"
          description="У вас нет доступа к этому курсу. Backend отклонил запрос (403)."
        />
      );
    }
    if (status === 404) {
      return (
        <ErrorState title="Курс не найден" description="Возможно, он удалён или ссылка устарела." />
      );
    }
    return (
      <ErrorState title="Не удалось загрузить курс" onRetry={() => void courseQuery.refetch()} />
    );
  }

  if (courseQuery.isLoading || !courseQuery.data) {
    return <div className="h-40 animate-pulse rounded-xl bg-slate-100" />;
  }

  const course = courseQuery.data;
  const caps = course.capabilities;

  return (
    <div className="space-y-6">
      <PageHeader
        title={course.title}
        description={course.description}
        actions={
          <div className="flex flex-wrap gap-2">
            {caps.canEditDraft ? (
              <Link to={academyRoutes.builder(course.id)}>
                <Button>Конструктор</Button>
              </Link>
            ) : null}
            {course.latestPublishedVersion ? (
              <Link to={academyRoutes.previewVersion(course.latestPublishedVersion.id)}>
                <Button variant="secondary">Предпросмотр</Button>
              </Link>
            ) : null}
            {caps.canCopyToCompany && course.latestPublishedVersion ? (
              <Button
                loading={copyPartnerCourse.isPending}
                onClick={() =>
                  copyPartnerCourse.mutate({
                    versionId: course.latestPublishedVersion!.id,
                    idempotencyKey: crypto.randomUUID(),
                  })
                }
              >
                Копировать в компанию
              </Button>
            ) : null}
            {caps.canPauseDistribution && course.distributionStatus === 'active' ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setRestriction('pause');
                  setRestrictionReason('');
                }}
              >
                Приостановить
              </Button>
            ) : null}
            {caps.canBlock && course.distributionStatus !== 'blocked' ? (
              <Button
                variant="danger"
                onClick={() => {
                  setRestriction('block');
                  setRestrictionReason('');
                }}
              >
                Заблокировать
              </Button>
            ) : null}
            {caps.canArchive && course.lifecycleStatus === 'active' ? (
              <Button
                variant="secondary"
                loading={lifecycle.isPending}
                onClick={() => setLifecycleConfirmation('archive')}
              >
                Архивировать
              </Button>
            ) : null}
            {caps.canRestore && course.lifecycleStatus === 'archived' ? (
              <Button variant="secondary" loading={lifecycle.isPending} onClick={() => lifecycle.mutate('restore')}>
                Восстановить
              </Button>
            ) : null}
            {caps.canResolveRestriction && course.distributionStatus !== 'active' ? (
              <Button variant="secondary" loading={lifecycle.isPending} onClick={() => lifecycle.mutate('resolve')}>
                Снять ограничение
              </Button>
            ) : null}
            {caps.canDelete ? (
              <Button
                variant="secondary"
                loading={lifecycle.isPending}
                onClick={() => setLifecycleConfirmation('delete')}
              >
                Удалить
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        <StatusBadgeFromPresentation status={lifecycleStatusLabel(course.lifecycleStatus)} />
        <StatusBadgeFromPresentation
          status={distributionStatusLabel(course.distributionStatus)}
        />
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
          {course.ownerType === 'partner' ? 'Курс партнёра' : 'Курс компании'}
        </span>
      </div>

      {course.restrictionReason ? (
        <AcademyStatusCallout
          tone="warning"
          title="Действует ограничение"
          description={course.restrictionReason}
        />
      ) : null}

      <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 text-sm">
        <WorkspaceTab to={academyRoutes.course(course.id)} label="Обзор" />
        {caps.canEditDraft ? (
          <WorkspaceTab to={academyRoutes.builder(course.id)} label="Контент" />
        ) : null}
        <WorkspaceTab to={academyRoutes.distribution(course.id)} label="Распространение" />
        <WorkspaceTab to={academyRoutes.courseReports(course.id)} label="Отчёты" />
        <WorkspaceTab to={academyRoutes.versions(course.id)} label="Версии" />
      </nav>

      <section className="rounded-xl border border-slate-200 bg-surface p-5 text-sm text-slate-600">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Черновик
            </dt>
            <dd className="mt-1">
              {course.draftVersion ? `v${course.draftVersion.versionNumber} (draft)` : 'Нет'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Опубликовано
            </dt>
            <dd className="mt-1">
              {course.latestPublishedVersion
                ? `v${course.latestPublishedVersion.versionNumber}`
                : 'Нет опубликованной версии'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Обновлён
            </dt>
            <dd className="mt-1">{new Date(course.updatedAt).toLocaleString('ru-RU')}</dd>
          </div>
          {course.origin?.sourceCourseTitle ? (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Источник
              </dt>
              <dd className="mt-1">{course.origin.sourceCourseTitle}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <Modal
        open={lifecycleConfirmation != null}
        onOpenChange={(open) => {
          if (!open && !lifecycle.isPending) setLifecycleConfirmation(null);
        }}
        title={
          lifecycleConfirmation === 'delete'
            ? 'Удалить курс?'
            : 'Архивировать курс?'
        }
        description={
          lifecycleConfirmation === 'delete'
            ? 'Контент станет недоступен, а исторические результаты сохранятся.'
            : 'Новые назначения и активации будут остановлены до восстановления курса.'
        }
        footer={
          <>
            <Button
              variant="secondary"
              disabled={lifecycle.isPending}
              onClick={() => setLifecycleConfirmation(null)}
            >
              Отмена
            </Button>
            <Button
              variant={lifecycleConfirmation === 'delete' ? 'danger' : 'primary'}
              loading={lifecycle.isPending}
              onClick={() => {
                if (!lifecycleConfirmation) return;
                lifecycle.mutate(lifecycleConfirmation, {
                  onSuccess: () => setLifecycleConfirmation(null),
                });
              }}
            >
              {lifecycleConfirmation === 'delete' ? 'Удалить' : 'Архивировать'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Это действие изменит доступ к курсу для всех новых прохождений.
        </p>
      </Modal>

      <Modal
        open={restriction != null}
        onOpenChange={(open) => {
          if (!open) {
            setRestriction(null);
            setRestrictionReason('');
          }
        }}
        title={
          restriction === 'block'
            ? 'Заблокировать курс партнёра'
            : 'Приостановить распространение'
        }
        description={
          restriction === 'block'
            ? 'Экстренная блокировка остановит активные прохождения. Причина обязательна.'
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
              variant={restriction === 'block' ? 'danger' : 'primary'}
              disabled={restrictionReason.trim().length < 3}
              loading={restrictPartnerCourse.isPending}
              onClick={() => {
                if (!restriction || restrictionReason.trim().length < 3) return;
                restrictPartnerCourse.mutate({
                  action: restriction,
                  reason: restrictionReason.trim(),
                });
              }}
            >
              {restriction === 'block' ? 'Заблокировать' : 'Приостановить'}
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
        />
      </Modal>
    </div>
  );
}

function WorkspaceTab({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="rounded-md px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    >
      {label}
    </Link>
  );
}

export function CourseVersionsPage() {
  const { courseId = '' } = useParams();
  useTitle('Версии курса — Академия — TeamOS');

  const versionsQuery = useQuery({
    queryKey: queryKeys.academyV2.versions(courseId),
    queryFn: ({ signal }) => academyVersionsApi.list(courseId, { signal }),
    enabled: Boolean(courseId),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Версии и история"
        description="Неизменяемые опубликованные версии и черновик. Прохождения фиксируют courseVersionId."
        actions={
          <Link to={academyRoutes.course(courseId)}>
            <Button variant="secondary">К курсу</Button>
          </Link>
        }
      />
      {versionsQuery.isError ? (
        <ErrorState onRetry={() => void versionsQuery.refetch()} />
      ) : versionsQuery.isLoading ? (
        <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
      ) : (versionsQuery.data ?? []).length === 0 ? (
        <p className="text-sm text-slate-500">Версий пока нет. Опубликуйте draft в конструкторе.</p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-surface">
          {(versionsQuery.data ?? []).map((version) => (
            <li
              key={version.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="font-medium text-slate-900">
                  v{version.versionNumber} · {version.title}
                </p>
                <p className="text-xs text-slate-500">
                  {version.status === 'published' ? 'Опубликована' : 'Черновик'}
                  {version.publishedAt
                    ? ` · ${new Date(version.publishedAt).toLocaleString('ru-RU')}`
                    : ''}
                  {version.sectionCount != null ? ` · разделов: ${version.sectionCount}` : ''}
                  {version.lessonCount != null ? ` · уроков: ${version.lessonCount}` : ''}
                </p>
              </div>
              {version.status === 'published' ? (
                <Link to={academyRoutes.previewVersion(version.id)}>
                  <Button size="sm" variant="secondary">
                    Предпросмотр
                  </Button>
                </Link>
              ) : (
                <Link to={academyRoutes.builder(courseId)}>
                  <Button size="sm" variant="secondary">
                    В конструктор
                  </Button>
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CourseDistributionPage() {
  const { courseId = '' } = useParams();
  const queryClient = useQueryClient();
  const [targetType, setTargetType] = useState<'user' | 'position' | 'department'>('user');
  const [targetId, setTargetId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [accessEmail, setAccessEmail] = useState('');
  const [accessFirstName, setAccessFirstName] = useState('');
  const [accessDeadline, setAccessDeadline] = useState('3');
  const [campaignName, setCampaignName] = useState('');
  const [campaignDeadline, setCampaignDeadline] = useState('3');
  const [extendAccessId, setExtendAccessId] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState('1');
  const [oneTimeSecretUrl, setOneTimeSecretUrl] = useState<string | null>(null);
  const createAccessResetRef = useRef<() => void>(() => undefined);
  const mutateAccessResetRef = useRef<() => void>(() => undefined);
  const createCampaignResetRef = useRef<() => void>(() => undefined);
  const mutateCampaignResetRef = useRef<() => void>(() => undefined);
  useTitle('Распространение — Академия — TeamOS');

  const courseQuery = useQuery({
    queryKey: queryKeys.academyV2.course(courseId),
    queryFn: ({ signal }) => academyCoursesApi.get(courseId, { signal }),
    enabled: Boolean(courseId),
  });
  const assignmentsQuery = useQuery({
    queryKey: queryKeys.academyV2.assignments(courseId),
    queryFn: ({ signal }) => academyDistributionApi.listAssignments(courseId, { signal }),
    enabled: Boolean(courseId && courseQuery.data?.capabilities.canAssignInternally),
  });

  const caps = courseQuery.data?.capabilities;
  const publishedVersionId = courseQuery.data?.latestPublishedVersion?.id;
  const accessDeadlineDays = parseDeadlineDays(accessDeadline);
  const campaignDeadlineDays = parseDeadlineDays(campaignDeadline);
  const parsedExtendDays = Number(extendDays);
  const extendDaysValid = Number.isInteger(parsedExtendDays) && parsedExtendDays >= 1;

  const createAssignment = useMutation({
    mutationFn: () =>
      academyDistributionApi.assign(
        courseId,
        {
          targetType,
          targetId: targetId.trim(),
          dueDate: dueDate || undefined,
          courseVersionId: publishedVersionId,
        },
        { idempotencyKey: crypto.randomUUID() },
      ),
    onSuccess: () => {
      setTargetId('');
      setDueDate('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.assignments(courseId) });
      toast.success('Назначение создано');
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Не удалось назначить курс'),
  });
  const revokeAssignment = useMutation({
    mutationFn: (assignmentId: string) => academyDistributionApi.revokeAssignment(assignmentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.assignments(courseId) });
      toast.success('Назначение отозвано');
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Не удалось отозвать назначение'),
  });
  const personalAccessesQuery = useQuery({
    queryKey: queryKeys.academyV2.personalAccesses(courseId, { page: 1, pageSize: 50 }),
    queryFn: ({ signal }) => academyExternalAdminApi.listPersonalAccesses(courseId, { page: 1, pageSize: 50 }, { signal }),
    enabled: Boolean(courseId && caps?.canCreatePersonalAccess),
  });
  const createAccess = useMutation({
    mutationFn: () => {
      if (!publishedVersionId) throw new Error('no published version');
      const deadlineDays = parseDeadlineDays(accessDeadline);
      if (deadlineDays == null) throw new Error('invalid deadline');
      return academyExternalAdminApi.createPersonalAccess(
        courseId,
        publishedVersionId,
        {
          email: accessEmail.trim(),
          firstName: accessFirstName.trim() || undefined,
          deadlineDays,
        },
        { idempotencyKey: crypto.randomUUID() },
      );
    },
    onSuccess: async (access) => {
      setAccessEmail('');
      setAccessFirstName('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.personalAccesses(courseId, { page: 1, pageSize: 50 }) });
      if (!access.publicUrl) {
        toast.success('Персональный доступ создан');
        createAccessResetRef.current();
        return;
      }
      setOneTimeSecretUrl(access.publicUrl);
      try {
        await navigator.clipboard.writeText(access.publicUrl);
        toast.success('Ссылка создана и скопирована');
      } catch {
        toast.error('Доступ создан, но ссылку не удалось скопировать');
      }
      createAccessResetRef.current();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Не удалось создать доступ'),
  });
  const mutateAccess = useMutation({
    mutationFn: async (input: {
      accessId: string;
      action: 'rotate' | 'revoke' | 'extend' | 'repeat';
      extraDays?: number;
    }) => {
      if (input.action === 'rotate') {
        return academyExternalAdminApi.rotatePersonalAccess(input.accessId, {
          idempotencyKey: crypto.randomUUID(),
        });
      }
      if (input.action === 'revoke') {
        await academyExternalAdminApi.revokePersonalAccess(input.accessId);
        return null;
      }
      if (input.action === 'repeat') {
        await academyExternalAdminApi.repeatPersonalAccess(input.accessId, {
          idempotencyKey: crypto.randomUUID(),
        });
        return null;
      }
      if (!Number.isInteger(input.extraDays) || (input.extraDays ?? 0) < 1) {
        throw new Error('invalid extension');
      }
      await academyExternalAdminApi.extendPersonalAccess(input.accessId, {
        extraDays: input.extraDays!,
      });
      return null;
    },
    onSuccess: async (result, input) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.personalAccesses(courseId, { page: 1, pageSize: 50 }) });
      if (result?.publicUrl) {
        setOneTimeSecretUrl(result.publicUrl);
        try {
          await navigator.clipboard.writeText(result.publicUrl);
          toast.success('Новая ссылка скопирована');
        } catch {
          toast.error('Ссылка обновлена, но её не удалось скопировать');
        }
      } else {
        toast.success(
          input.action === 'revoke'
            ? 'Доступ отозван'
            : input.action === 'repeat'
              ? 'Повторное прохождение создано'
              : 'Доступ продлён',
        );
      }
      if (input.action === 'extend') {
        setExtendAccessId(null);
        setExtendDays('1');
      }
      mutateAccessResetRef.current();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Не удалось изменить доступ'),
  });
  const campaignsQuery = useQuery({
    queryKey: queryKeys.academyV2.campaigns(courseId),
    queryFn: ({ signal }) => academyExternalAdminApi.listCampaigns(courseId, { signal }),
    enabled: Boolean(courseId && (caps?.canCreatePromoCampaign || caps?.canCreateCandidateCampaign)),
  });
  const createCampaign = useMutation({
    mutationFn: () => {
      if (!publishedVersionId) throw new Error('no published version');
      const deadlineDays = parseDeadlineDays(campaignDeadline);
      if (deadlineDays == null) throw new Error('invalid deadline');
      return academyExternalAdminApi.createCampaign(
        courseId,
        publishedVersionId,
        {
          purpose: caps?.canCreateCandidateCampaign ? 'company_candidate' : 'partner_promo',
          name: campaignName.trim(),
          deadlineDays,
        },
        { idempotencyKey: crypto.randomUUID() },
      );
    },
    onSuccess: (campaign) => {
      setCampaignName('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.campaigns(courseId) });
      if (campaign.publicUrl) setOneTimeSecretUrl(campaign.publicUrl);
      toast.success('Кампания создана');
      createCampaignResetRef.current();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Не удалось создать кампанию'),
  });
  const mutateCampaign = useMutation({
    mutationFn: async (input: { campaignId: string; action: 'pause' | 'resume' | 'rotate' | 'revoke' }) => {
      if (input.action === 'pause') return academyExternalAdminApi.pauseCampaign(input.campaignId);
      if (input.action === 'resume') return academyExternalAdminApi.resumeCampaign(input.campaignId);
      if (input.action === 'revoke') return academyExternalAdminApi.revokeCampaign(input.campaignId);
      return academyExternalAdminApi.rotateCampaign(input.campaignId, {
        idempotencyKey: crypto.randomUUID(),
      });
    },
    onSuccess: async (result, input) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.campaigns(courseId) });
      if (input.action === 'rotate' && result.publicUrl) {
        setOneTimeSecretUrl(result.publicUrl);
        try {
          await navigator.clipboard.writeText(result.publicUrl);
          toast.success('Новая ссылка кампании скопирована');
        } catch {
          toast.error('Ссылка обновлена, но её не удалось скопировать');
        }
        mutateCampaignResetRef.current();
        return;
      }
      toast.success(
        input.action === 'pause'
          ? 'Кампания приостановлена'
          : input.action === 'resume'
            ? 'Кампания возобновлена'
            : 'Кампания отозвана',
      );
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Не удалось изменить кампанию'),
  });
  useEffect(() => {
    createAccessResetRef.current = createAccess.reset;
    mutateAccessResetRef.current = mutateAccess.reset;
    createCampaignResetRef.current = createCampaign.reset;
    mutateCampaignResetRef.current = mutateCampaign.reset;
  }, [createAccess.reset, createCampaign.reset, mutateAccess.reset, mutateCampaign.reset]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Распространение"
        description="Внутренние назначения, внешние доступы и кампании — по capabilities."
        actions={
          <Link to={academyRoutes.course(courseId)}>
            <Button variant="secondary">К курсу</Button>
          </Link>
        }
      />

      {caps?.canAssignInternally ? (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-surface p-4">
          <h2 className="text-sm font-semibold text-slate-900">Внутренние назначения</h2>
          <div className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[10rem_1fr_11rem_auto]">
            <Select
              value={targetType}
              onValueChange={(value) => setTargetType(value as typeof targetType)}
              options={[
                { value: 'user', label: 'Сотрудник' },
                { value: 'position', label: 'Должность' },
                { value: 'department', label: 'Отдел' },
              ]}
            />
            <Input value={targetId} onChange={(event) => setTargetId(event.target.value)} placeholder="ID получателя" />
            <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} aria-label="Срок назначения" />
            <Button disabled={!targetId.trim() || !publishedVersionId} loading={createAssignment.isPending} onClick={() => createAssignment.mutate()}>Назначить</Button>
          </div>
          {assignmentsQuery.isLoading ? (
            <div className="h-16 animate-pulse rounded bg-slate-100" />
          ) : (assignmentsQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">Назначений пока нет.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {(assignmentsQuery.data ?? []).map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    {row.targetName ?? row.targetId}{' '}
                    <span className="text-slate-400">
                      ({assignmentTargetLabels[row.targetType]})
                    </span>
                  </span>
                  <span className="text-slate-500">
                    {row.completedEnrollments}/{row.activeEnrollments + row.completedEnrollments}{' '}
                    завершили
                  </span>
                  <Button size="sm" variant="ghost" loading={revokeAssignment.isPending} onClick={() => revokeAssignment.mutate(row.id)}>Отозвать</Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {caps?.canCreatePersonalAccess ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-surface p-4">
          <h2 className="text-sm font-semibold text-slate-900">Персональные внешние доступы</h2>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_7rem_auto]">
            <Input type="email" value={accessEmail} onChange={(event) => setAccessEmail(event.target.value)} placeholder="email@example.com" />
            <Input value={accessFirstName} onChange={(event) => setAccessFirstName(event.target.value)} placeholder="Имя" />
            <Input
              type="number"
              min={1}
              max={7}
              label="Дней"
              value={accessDeadline}
              onChange={(event) => setAccessDeadline(event.target.value)}
              error={accessDeadlineDays == null ? 'От 1 до 7 дней' : undefined}
            />
            <Button
              disabled={!accessEmail.trim() || !publishedVersionId || accessDeadlineDays == null}
              loading={createAccess.isPending}
              onClick={() => createAccess.mutate()}
            >
              Создать
            </Button>
          </div>
          {personalAccessesQuery.isError ? <ErrorState title="Не удалось загрузить доступы" onRetry={() => void personalAccessesQuery.refetch()} /> : personalAccessesQuery.isLoading ? (
            <div className="h-16 animate-pulse rounded bg-slate-100" />
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {(personalAccessesQuery.data?.items ?? []).map((access) => (
                <li key={access.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>{access.email}</span>
                  <span className="text-slate-500">
                    {personalAccessStatusLabels[access.status]} · {access.deadlineDays} дн.
                  </span>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" loading={mutateAccess.isPending} onClick={() => mutateAccess.mutate({ accessId: access.id, action: 'rotate' })}>Новая ссылка</Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setExtendAccessId(access.id);
                        setExtendDays('1');
                      }}
                    >
                      Продлить
                    </Button>
                    {access.status === 'activated' ? <Button size="sm" variant="ghost" loading={mutateAccess.isPending} onClick={() => mutateAccess.mutate({ accessId: access.id, action: 'repeat' })}>Повтор</Button> : null}
                    {access.status !== 'revoked' && access.status !== 'closed' ? <Button size="sm" variant="ghost" loading={mutateAccess.isPending} onClick={() => mutateAccess.mutate({ accessId: access.id, action: 'revoke' })}>Отозвать</Button> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {caps?.canCreatePromoCampaign || caps?.canCreateCandidateCampaign ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-surface p-4">
          <h2 className="text-sm font-semibold text-slate-900">{caps?.canCreateCandidateCampaign ? 'Candidate-кампании' : 'Промокампании'}</h2>
          <div className="grid gap-2 sm:grid-cols-[1fr_7rem_auto]">
            <Input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="Название кампании" />
            <Input
              type="number"
              min={1}
              max={7}
              label="Дней"
              value={campaignDeadline}
              onChange={(event) => setCampaignDeadline(event.target.value)}
              error={campaignDeadlineDays == null ? 'От 1 до 7 дней' : undefined}
            />
            <Button
              disabled={!campaignName.trim() || !publishedVersionId || campaignDeadlineDays == null}
              loading={createCampaign.isPending}
              onClick={() => createCampaign.mutate()}
            >
              Создать
            </Button>
          </div>
          {campaignsQuery.isError ? (
            <ErrorState title="Не удалось загрузить кампании" onRetry={() => void campaignsQuery.refetch()} />
          ) : campaignsQuery.isLoading ? (
            <div className="h-16 animate-pulse rounded bg-slate-100" />
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {(campaignsQuery.data ?? []).map((campaign) => (
                <li key={campaign.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>{campaign.name}</span>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="mr-1 text-slate-500">
                      {campaignStatusLabels[campaign.status]}
                    </span>
                    {campaign.status === 'active' ? <Button size="sm" variant="ghost" loading={mutateCampaign.isPending} onClick={() => mutateCampaign.mutate({ campaignId: campaign.id, action: 'pause' })}>Пауза</Button> : null}
                    {campaign.status === 'paused' ? <Button size="sm" variant="ghost" loading={mutateCampaign.isPending} onClick={() => mutateCampaign.mutate({ campaignId: campaign.id, action: 'resume' })}>Возобновить</Button> : null}
                    {campaign.status !== 'revoked' && campaign.status !== 'closed' ? <><Button size="sm" variant="ghost" loading={mutateCampaign.isPending} onClick={() => mutateCampaign.mutate({ campaignId: campaign.id, action: 'rotate' })}>Новая ссылка</Button><Button size="sm" variant="ghost" loading={mutateCampaign.isPending} onClick={() => mutateCampaign.mutate({ campaignId: campaign.id, action: 'revoke' })}>Отозвать</Button></> : null}
                    <Link to={academyRoutes.campaign(campaign.id)}><Button size="sm" variant="secondary">Отчёт</Button></Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <Modal
        open={extendAccessId != null}
        onOpenChange={(open) => {
          if (!open) {
            setExtendAccessId(null);
            setExtendDays('1');
          }
        }}
        title="Продлить доступ"
        description="Срок текущего прохождения будет увеличен на указанное количество дней."
        footer={
          <>
            <Button variant="secondary" onClick={() => setExtendAccessId(null)}>Отмена</Button>
            <Button
              disabled={!extendDaysValid}
              loading={mutateAccess.isPending}
              onClick={() => {
                if (!extendAccessId || !extendDaysValid) return;
                mutateAccess.mutate({
                  accessId: extendAccessId,
                  action: 'extend',
                  extraDays: parsedExtendDays,
                });
              }}
            >
              Продлить
            </Button>
          </>
        }
      >
        <Input
          type="number"
          min={1}
          label="Дополнительные дни"
          value={extendDays}
          onChange={(event) => setExtendDays(event.target.value)}
          error={!extendDaysValid ? 'Введите целое число не меньше 1' : undefined}
        />
      </Modal>

      <Modal
        open={Boolean(oneTimeSecretUrl)}
        onOpenChange={(open) => {
          if (!open) setOneTimeSecretUrl(null);
        }}
        title="Ссылка создана"
        description="Это одноразовый показ секрета. Сохраните ссылку до закрытия окна."
        footer={
          <Button onClick={() => setOneTimeSecretUrl(null)}>Готово</Button>
        }
      >
        <div className="space-y-3">
          <Input readOnly value={oneTimeSecretUrl ?? ''} aria-label="Одноразовая внешняя ссылка" />
          <Button
            variant="secondary"
            onClick={async () => {
              if (!oneTimeSecretUrl) return;
              try {
                await navigator.clipboard.writeText(oneTimeSecretUrl);
                toast.success('Ссылка скопирована');
              } catch {
                toast.error('Не удалось скопировать ссылку');
              }
            }}
          >
            Скопировать
          </Button>
        </div>
      </Modal>

      {!caps?.canAssignInternally &&
      !caps?.canCreatePersonalAccess &&
      !caps?.canCreatePromoCampaign &&
      !caps?.canCreateCandidateCampaign ? (
        <p className="text-sm text-slate-500">Нет доступных действий распространения для этой роли.</p>
      ) : null}
    </div>
  );
}

export function CourseReportsPage() {
  const { courseId = '' } = useParams();
  useTitle('Отчёты курса — Академия — TeamOS');

  return (
    <div className="space-y-4">
      <PageHeader
        title="Отчёты курса"
        description="Серверные read models. Фильтры синхронизированы с URL на странице «Отчёты»."
        actions={
          <div className="flex gap-2">
            <Link to={`${academyRoutes.reports}?courseId=${encodeURIComponent(courseId)}`}>
              <Button size="sm">Открыть в центре отчётов</Button>
            </Link>
            <Link to={academyRoutes.course(courseId)}>
              <Button size="sm" variant="secondary">
                К курсу
              </Button>
            </Link>
          </div>
        }
      />
      <p className="text-sm text-slate-500">
        Детальная таблица, CSV и external funnel доступны в ролевом центре отчётности.
      </p>
    </div>
  );
}
