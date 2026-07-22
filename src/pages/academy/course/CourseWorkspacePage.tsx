import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useTitle } from '@reactuses/core';
import { academyCoursesApi } from '@/api/academy';
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
  return (
    <div className="space-y-4">
      <PageHeader
        title="Версии и история"
        description="Неизменяемые опубликованные версии и черновик."
        actions={
          <Link to={academyRoutes.course(courseId)}>
            <Button variant="secondary">К курсу</Button>
          </Link>
        }
      />
      <p className="text-sm text-slate-500">
        Список версий подключается к `GET /academy/v2/courses/:id/versions` в Phase 3.
      </p>
    </div>
  );
}

export function CourseDistributionPage() {
  const { courseId = '' } = useParams();
  useTitle('Распространение — Академия — TeamOS');
  return (
    <div className="space-y-4">
      <PageHeader
        title="Распространение"
        description="Назначения, персональные доступы и кампании — по capabilities курса."
        actions={
          <Link to={academyRoutes.course(courseId)}>
            <Button variant="secondary">К курсу</Button>
          </Link>
        }
      />
      <p className="text-sm text-slate-500">UI назначений и внешних доступов — Phases 3–8.</p>
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
        description="Серверные read models с фильтрами и pagination."
        actions={
          <Link to={academyRoutes.course(courseId)}>
            <Button variant="secondary">К курсу</Button>
          </Link>
        }
      />
      <p className="text-sm text-slate-500">Internal/external course reports — Phases 3–8.</p>
    </div>
  );
}
