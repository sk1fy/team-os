import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useTitle } from '@reactuses/core';
import {
  academyCoursesApi,
  academyDistributionApi,
  academyVersionsApi,
} from '@/api/academy';
import { queryKeys } from '@/api/queryKeys';
import { PageHeader } from '@/components/layout/PageHeader';
import { ErrorState } from '@/components/layout/ErrorState';
import { Button } from '@/components/ui';
import {
  academyRoutes,
  distributionStatusLabel,
  lifecycleStatusLabel,
} from '@/lib/academy';
import { StatusBadgeFromPresentation } from '../components/StatusBadge';
import { AcademyStatusCallout } from '../components/AcademyStatusCallout';

export function CourseWorkspacePage() {
  const { courseId = '' } = useParams();
  useTitle('Курс — Академия — TeamOS');

  const courseQuery = useQuery({
    queryKey: queryKeys.academyV2.course(courseId),
    queryFn: ({ signal }) => academyCoursesApi.get(courseId, { signal }),
    enabled: Boolean(courseId),
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
          {assignmentsQuery.isLoading ? (
            <div className="h-16 animate-pulse rounded bg-slate-100" />
          ) : (assignmentsQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">Назначений пока нет.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {(assignmentsQuery.data ?? []).map((row) => (
                <li key={row.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>
                    {row.targetName ?? row.targetId}{' '}
                    <span className="text-slate-400">({row.targetType})</span>
                  </span>
                  <span className="text-slate-500">
                    {row.completedEnrollments}/{row.activeEnrollments + row.completedEnrollments}{' '}
                    завершили
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {caps?.canCreatePersonalAccess || caps?.canCreatePromoCampaign ? (
        <section className="rounded-xl border border-slate-200 bg-surface p-4 text-sm text-slate-600">
          Персональные ссылки и промокампании — Phase 7–8 (API adapters уже в{' '}
          <code>academyExternalAdminApi</code>).
        </section>
      ) : null}

      {caps?.canCreateCandidateCampaign ? (
        <section className="rounded-xl border border-slate-200 bg-surface p-4 text-sm text-slate-600">
          Candidate-кампании компании — Phase 8.
        </section>
      ) : null}

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
