import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { BookOpen, GraduationCap, Users } from 'lucide-react';
import {
  academyCoursesApi,
  academyExternalAdminApi,
  academyLearningApi,
  academyReportsApi,
  academyTemplatesApi,
} from '@/api/academy';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Input, Modal, Textarea } from '@/components/ui';
import {
  academyRoutes,
  enrollmentAccessLabel,
  enrollmentProgressLabel,
  lifecycleStatusLabel,
} from '@/lib/academy';
import { toast } from '@/stores/toast';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { createId } from '@/lib/id';
import { waitForInstantiatedDraft } from './templates/templateInstantiation';

export { AcademyPartnerCoursesPage } from './partners/AcademyPartnerCoursesPage';
export { AcademyTemplatesPage } from './templates/AcademyTemplatesPage';
export { AcademyReportsPage } from './reports/AcademyReportsPage';

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString('ru-RU') : '—';
}

function QueryError({ retry }: { retry: () => void }) {
  return <ErrorState onRetry={retry} />;
}

export function AcademyPartnerPage() {
  const { partnerId = '' } = useParams();
  useTitle('Курсы партнёра — Академия — TeamOS');
  const query = useQuery({
    queryKey: queryKeys.academyV2.partnerCourses(partnerId, { pageSize: 100 }),
    queryFn: ({ signal }) =>
      academyReportsApi.partnerCourses(partnerId, { page: 1, pageSize: 100 }, { signal }),
    enabled: Boolean(partnerId),
  });
  const courses = useMemo(() => query.data?.items ?? [], [query.data?.items]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={courses[0]?.ownerDisplayName ?? 'Курсы партнёра'}
        description="Read-only обзор оригиналов партнёра. Редактирование оригиналов администрацией запрещено."
        actions={
          <Link to={academyRoutes.partners}>
            <Button variant="secondary">К партнёрам</Button>
          </Link>
        }
      />
      {query.isError ? (
        <QueryError retry={() => void query.refetch()} />
      ) : query.isLoading ? (
        <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
      ) : courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Курсов нет"
          description="У партнёра пока нет доступных курсов."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {courses.map((course) => (
            <li key={course.id} className="rounded-xl border border-slate-200 bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-slate-900">{course.title}</h2>
                <Badge>{lifecycleStatusLabel(course.lifecycleStatus).label}</Badge>
              </div>
              <p className="mt-2 text-sm text-slate-500">{course.description || 'Без описания'}</p>
              <Link className="mt-4 inline-flex" to={academyRoutes.course(course.id)}>
                <Button size="sm" variant="secondary">
                  Открыть read-only
                </Button>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AcademyTemplatePage() {
  const { templateId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useTitle('Шаблон — Академия — TeamOS');
  const templateQuery = useQuery({
    queryKey: queryKeys.academyV2.template(templateId),
    queryFn: ({ signal }) => academyTemplatesApi.get(templateId, { signal }),
    enabled: Boolean(templateId),
  });
  const previewQuery = useQuery({
    queryKey: [...queryKeys.academyV2.template(templateId), 'preview'],
    queryFn: ({ signal }) => academyTemplatesApi.getPreview(templateId, { signal }),
    enabled: Boolean(templateId && templateQuery.data?.capabilities.canPreview),
  });
  const instantiate = useMutation({
    mutationFn: async (versionId: string) => {
      const result = await academyTemplatesApi.instantiateDetailed(
        versionId,
        {},
        { idempotencyKey: createId() },
      );
      const expectedLessonCount = previewQuery.data?.sections.reduce(
        (total, section) => total + section.lessons.length,
        0,
      );
      return {
        ...result,
        draft: await waitForInstantiatedDraft({
          initialDraft: result.draft,
          expectedLessonCount,
          loadDraft: () => academyCoursesApi.getDraft(result.course.id),
        }),
      };
    },
    onSuccess: ({ course, draft }) => {
      // The instantiate response already contains the fully materialized draft.
      // Seed both queries before navigation so the builder never renders a
      // misleading editable "0 sections / 0 lessons" intermediate state.
      queryClient.setQueryData(queryKeys.academyV2.course(course.id), course);
      queryClient.setQueryData(queryKeys.academyV2.draft(course.id), draft);
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.coursesRoot });
      toast.success('Курс создан из шаблона');
      navigate(academyRoutes.builder(course.id));
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Не удалось создать курс'),
  });
  const archive = useMutation({
    mutationFn: () => academyTemplatesApi.archive(templateId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.template(templateId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.templatesRoot });
      toast.success('Шаблон архивирован');
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Не удалось архивировать шаблон'),
  });

  if (templateQuery.isError) return <QueryError retry={() => void templateQuery.refetch()} />;
  if (!templateQuery.data) return <div className="h-40 animate-pulse rounded-xl bg-slate-100" />;
  const template = templateQuery.data;
  const preview = previewQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={template.title}
        description={template.description}
        actions={
          <div className="flex flex-wrap gap-2">
            {template.capabilities.canInstantiate && template.latestVersionId ? (
              <Button
                loading={instantiate.isPending}
                onClick={() => instantiate.mutate(template.latestVersionId!)}
              >
                Создать курс
              </Button>
            ) : null}
            {template.capabilities.canEdit ? (
              <Link to={academyRoutes.templateBuilder(template.id)}>
                <Button variant="secondary">Редактировать</Button>
              </Link>
            ) : null}
            {template.capabilities.canArchive && !template.archived ? (
              <Button
                variant="secondary"
                loading={archive.isPending}
                onClick={() => archive.mutate()}
              >
                Архивировать
              </Button>
            ) : null}
          </div>
        }
      />
      <div className="flex gap-2">
        <Badge>{template.ownerType === 'system' ? 'Системный' : 'Корпоративный'}</Badge>
        {template.archived ? <Badge variant="warning">В архиве</Badge> : null}
      </div>
      {previewQuery.isError ? (
        <ErrorState title="Предпросмотр недоступен" onRetry={() => void previewQuery.refetch()} />
      ) : previewQuery.isLoading ? (
        <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
      ) : preview ? (
        <section className="rounded-xl border border-slate-200 bg-surface p-5">
          <h2 className="font-semibold text-slate-900">Программа шаблона</h2>
          <ul className="mt-4 space-y-4">
            {preview.sections.map((section) => (
              <li key={section.id}>
                <p className="text-sm font-semibold text-slate-700">{section.title}</p>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-slate-500">
                  {section.lessons.map((lesson) => (
                    <li key={lesson.id}>{lesson.title}</li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function AcademyLearnersPage() {
  useTitle('Внешние ученики — Академия — TeamOS');
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const debouncedQ = useDebouncedValue(q);
  const page = Math.max(1, Number(params.get('page')) || 1);
  const filters = useMemo(
    () => ({ q: debouncedQ || undefined, page, pageSize: 25 }),
    [debouncedQ, page],
  );
  const query = useQuery({
    queryKey: queryKeys.academyV2.externalLearners(filters),
    queryFn: ({ signal }) => academyExternalAdminApi.listLearners(filters, { signal }),
  });
  const learners = query.data?.items ?? [];
  const setPage = (next: number) =>
    setParams((prev) => {
      const result = new URLSearchParams(prev);
      result.set('page', String(next));
      return result;
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Внешние ученики"
        description="Люди без TeamOS User и история их прохождений."
      />
      <Input
        className="max-w-md"
        value={q}
        placeholder="Поиск по имени или email…"
        onChange={(event) =>
          setParams((prev) => {
            const next = new URLSearchParams(prev);
            if (event.target.value) next.set('q', event.target.value);
            else next.delete('q');
            next.delete('page');
            return next;
          })
        }
      />
      {query.isError ? (
        <QueryError retry={() => void query.refetch()} />
      ) : query.isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
      ) : learners.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Учеников нет"
          description="Здесь появятся активировавшие внешний доступ."
        />
      ) : (
        <>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-surface">
            {learners.map((learner) => (
              <li
                key={learner.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {learner.displayName || learner.email}
                  </p>
                  <p className="text-xs text-slate-500">
                    {learner.email} · прохождений: {learner.enrollmentCount}
                  </p>
                </div>
                <Link to={academyRoutes.learner(learner.id)}>
                  <Button size="sm" variant="secondary">
                    История
                  </Button>
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex justify-between">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Назад
            </Button>
            <span className="text-sm text-slate-500">
              Страница {page} из {query.data!.totalPages || 1}
            </span>
            <Button
              variant="secondary"
              disabled={page >= query.data!.totalPages}
              onClick={() => setPage(page + 1)}
            >
              Далее
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export function AcademyLearnerPage() {
  const { learnerId = '' } = useParams();
  useTitle('Карточка внешнего ученика — Академия — TeamOS');
  const query = useQuery({
    queryKey: queryKeys.academyV2.externalLearner(learnerId),
    queryFn: ({ signal }) => academyExternalAdminApi.getLearner(learnerId, { signal }),
    enabled: Boolean(learnerId),
  });
  if (query.isError) return <QueryError retry={() => void query.refetch()} />;
  if (!query.data) return <div className="h-40 animate-pulse rounded-xl bg-slate-100" />;
  const learner = query.data;
  const timeline = learner.timeline ?? [];
  return (
    <div className="space-y-6">
      <PageHeader title={learner.displayName || learner.email} description={learner.email} />
      {timeline.length === 0 ? (
        <EmptyState icon={GraduationCap} title="Прохождений нет" />
      ) : (
        <ol className="space-y-3">
          {timeline.map((node) => (
            <li
              key={node.enrollmentId}
              className="rounded-xl border border-slate-200 bg-surface p-4"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{node.courseTitle}</p>
                  <p className="text-xs text-slate-500">
                    Активировано: {formatDate(node.activatedAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge>{enrollmentProgressLabel(node.progressStatus).label}</Badge>
                  <Badge>{enrollmentAccessLabel(node.accessStatus).label}</Badge>
                  <Badge>{node.percent}%</Badge>
                </div>
              </div>
              <Link
                className="mt-3 inline-flex"
                to={academyRoutes.enrollmentReport(node.enrollmentId)}
              >
                <Button size="sm" variant="secondary">
                  Отчёт
                </Button>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function AcademyCampaignPage() {
  const { campaignId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const requestedPage = Number(params.get('page') ?? '1');
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  useTitle('Кампания — Академия — TeamOS');
  const query = useQuery({
    queryKey: [...queryKeys.academyV2.campaignReport(campaignId), { page, pageSize: 50 }],
    queryFn: ({ signal }) =>
      academyExternalAdminApi.campaignReport(campaignId, { page, pageSize: 50 }, { signal }),
    enabled: Boolean(campaignId),
  });
  const courseQuery = useQuery({
    queryKey: queryKeys.academyV2.course(query.data?.courseId),
    queryFn: ({ signal }) => academyCoursesApi.get(query.data!.courseId, { signal }),
    enabled: Boolean(query.data?.courseId),
  });
  if (query.isError) return <QueryError retry={() => void query.refetch()} />;
  if (!query.data) return <div className="h-40 animate-pulse rounded-xl bg-slate-100" />;
  const report = query.data;
  return (
    <div className="space-y-6">
      <PageHeader
        title={report.campaignName}
        description={`${courseQuery.data?.title ?? report.courseTitle} · ${
          report.purpose === 'company_candidate' ? 'Кандидаты компании' : 'Промокампания партнёра'
        }`}
      />
      <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Object.entries(report.funnel).map(([key, value]) => {
          const labels: Record<string, string> = {
            landings: 'Открыли',
            verified: 'Подтвердили email',
            activated: 'Активировали',
            inProgress: 'В процессе',
            completed: 'Завершили',
            expired: 'Срок истёк',
          };
          return (
            <div key={key} className="rounded-xl border border-slate-200 bg-surface p-4">
              <dt className="text-xs text-slate-500">{labels[key] ?? key}</dt>
              <dd className="mt-1 text-xl font-semibold">{value}</dd>
            </div>
          );
        })}
      </dl>
      {report.analytics ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Активность и прогресс</h2>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CampaignMetric label="Начали первый урок" value={report.analytics.firstLessonStarts} />
            <CampaignMetric label="Завершили уроки" value={report.analytics.lessonCompletions} />
            <CampaignMetric label="Отправили тесты" value={report.analytics.quizSubmissions} />
            <CampaignMetric label="Повторные визиты" value={report.analytics.returnVisits} />
            <CampaignMetric
              label="Средний прогресс"
              value={`${report.analytics.averageProgressPercent}%`}
            />
            <CampaignMetric
              label="Медианный прогресс"
              value={`${report.analytics.medianProgressPercent}%`}
            />
            <CampaignMetric
              label="Среднее время завершения"
              value={formatDuration(report.analytics.averageCompletionSeconds)}
            />
            <CampaignMetric label="Истёкшие доступы" value={report.analytics.expiredEnrollments} />
          </dl>
        </section>
      ) : null}
      {report.utmBreakdown?.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Источники переходов</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-surface">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3">Источник</th>
                  <th className="px-4 py-3">Канал</th>
                  <th className="px-4 py-3">Кампания</th>
                  <th className="px-4 py-3">Переходы</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.utmBreakdown.map((row, index) => (
                  <tr
                    key={`${row.source ?? ''}-${row.medium ?? ''}-${row.campaign ?? ''}-${index}`}
                  >
                    <td className="px-4 py-3">{row.source || '—'}</td>
                    <td className="px-4 py-3">{row.medium || '—'}</td>
                    <td className="px-4 py-3">{row.campaign || '—'}</td>
                    <td className="px-4 py-3">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-surface">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3">Ученик</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Прогресс</th>
              <th className="px-4 py-3">Активирован</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {report.participants.items.map((row) => (
              <tr key={row.enrollmentId}>
                <td className="px-4 py-3">
                  {row.displayName || row.email || `Ученик ${row.learnerId}`}
                </td>
                <td className="px-4 py-3">
                  {enrollmentProgressLabel(row.progressStatus).label} ·{' '}
                  {enrollmentAccessLabel(row.accessStatus).label}
                </td>
                <td className="px-4 py-3">{row.percent}%</td>
                <td className="px-4 py-3">{formatDate(row.activatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="secondary"
          disabled={report.participants.page <= 1}
          onClick={() => setParams({ page: String(page - 1) })}
        >
          Назад
        </Button>
        <span className="text-sm text-slate-500">
          Страница {report.participants.page} из {report.participants.totalPages || 1}
        </span>
        <Button
          variant="secondary"
          disabled={report.participants.page >= report.participants.totalPages}
          onClick={() => setParams({ page: String(page + 1) })}
        >
          Далее
        </Button>
      </div>
    </div>
  );
}

function CampaignMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-surface p-4">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-xl font-semibold">{value}</dd>
    </div>
  );
}

function formatDuration(seconds?: number) {
  if (seconds === undefined) return '—';
  if (seconds < 60) return `${Math.round(seconds)} сек`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes > 0 ? `${hours} ч ${restMinutes} мин` : `${hours} ч`;
}

export function AcademyEnrollmentReportPage() {
  const { enrollmentId = '' } = useParams();
  const queryClient = useQueryClient();
  const [reviewAttemptId, setReviewAttemptId] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  useTitle('Индивидуальный отчёт — Академия — TeamOS');
  const query = useQuery({
    queryKey: queryKeys.academyV2.enrollmentReport(enrollmentId),
    queryFn: ({ signal }) => academyReportsApi.enrollment(enrollmentId, { signal }),
    enabled: Boolean(enrollmentId),
  });
  const reviewAttempt = useMutation({
    mutationFn: (input: { passed: boolean }) =>
      academyLearningApi.reviewQuizAttempt(enrollmentId, reviewAttemptId!, {
        passed: input.passed,
        comment: reviewComment,
      }),
    onSuccess: (_result, input) => {
      setReviewAttemptId(null);
      setReviewComment('');
      void queryClient.invalidateQueries({
        queryKey: queryKeys.academyV2.enrollmentReport(enrollmentId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.academyV2.enrollment(enrollmentId),
      });
      toast.success(input.passed ? 'Ответ принят' : 'Ответ отклонён');
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Не удалось проверить ответ'),
  });
  if (query.isError) return <QueryError retry={() => void query.refetch()} />;
  if (!query.data) return <div className="h-40 animate-pulse rounded-xl bg-slate-100" />;
  const report = query.data;
  const lessonResults = report.lessonResults ?? [];
  const quizAttempts = report.quizAttempts ?? [];
  const reviewTarget = quizAttempts.find((attempt) => attempt.attemptId === reviewAttemptId);
  const openAnswers =
    reviewTarget?.answers?.filter((answer) => Boolean(answer.openText?.trim())) ?? [];
  return (
    <div className="space-y-6">
      <PageHeader
        title={report.enrollment.courseTitle}
        description={`Прогресс ${report.enrollment.percent}% · ${enrollmentProgressLabel(report.enrollment.progressStatus).label} · ${enrollmentAccessLabel(report.enrollment.accessStatus).label}`}
      />
      <section className="rounded-xl border border-slate-200 bg-surface p-5">
        <h2 className="font-semibold text-slate-900">Результаты уроков</h2>
        <ul className="mt-3 divide-y divide-slate-100">
          {lessonResults.map((lesson) => (
            <li key={lesson.lessonId} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
              <span>{lesson.title}</span>
              <span className="text-slate-500">
                {lesson.completed
                  ? `Завершён${lesson.quizScore == null ? '' : ` · тест ${lesson.quizScore}%`}`
                  : 'Не завершён'}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-xl border border-slate-200 bg-surface p-5">
        <h2 className="font-semibold text-slate-900">Попытки тестов</h2>
        {quizAttempts.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Попыток пока нет.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {quizAttempts.map((attempt) => (
              <li
                key={attempt.attemptId}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    Попытка {attempt.attemptsUsed || '—'} · {attempt.score}%
                  </p>
                  <p className="text-xs text-slate-500">{formatDate(attempt.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      attempt.pendingReview ? 'warning' : attempt.passed ? 'success' : 'danger'
                    }
                  >
                    {attempt.pendingReview
                      ? 'Ожидает проверки'
                      : attempt.passed
                        ? 'Пройден'
                        : 'Не пройден'}
                  </Badge>
                  {attempt.pendingReview ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setReviewAttemptId(attempt.attemptId);
                        setReviewComment('');
                      }}
                    >
                      Проверить
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Modal
        open={reviewAttemptId != null}
        onOpenChange={(open) => {
          if (!open && !reviewAttempt.isPending) {
            setReviewAttemptId(null);
            setReviewComment('');
          }
        }}
        title="Проверить открытый ответ"
        description="Решение завершит pending_review. При положительной проверке backend атомарно обновит прогресс урока."
        footer={
          <>
            <Button
              variant="secondary"
              disabled={reviewAttempt.isPending}
              onClick={() => {
                setReviewAttemptId(null);
                setReviewComment('');
              }}
            >
              Отмена
            </Button>
            <Button
              variant="danger"
              loading={reviewAttempt.isPending}
              onClick={() => reviewAttempt.mutate({ passed: false })}
            >
              Отклонить
            </Button>
            <Button
              loading={reviewAttempt.isPending}
              onClick={() => reviewAttempt.mutate({ passed: true })}
            >
              Принять
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {openAnswers.length > 0 ? (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-900">Ответ ученика</h3>
              {openAnswers.map((answer) => (
                <div
                  key={answer.questionId}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                >
                  <p className="text-xs text-slate-500">Вопрос {answer.questionId}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-900">
                    {answer.openText}
                  </p>
                </div>
              ))}
            </section>
          ) : (
            <p className="text-sm text-slate-500">
              Текст открытого ответа отсутствует в ответе отчёта.
            </p>
          )}
          <Textarea
            label="Комментарий"
            value={reviewComment}
            rows={4}
            maxLength={2000}
            placeholder="Необязательно"
            onChange={(event) => setReviewComment(event.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
