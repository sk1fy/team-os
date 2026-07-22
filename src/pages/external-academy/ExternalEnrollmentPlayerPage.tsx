import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { academyExternalPublicApi } from '@/api/academy';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { Button } from '@/components/ui';
import { academyRoutes, deadlineRemaining, enrollmentAccessLabel } from '@/lib/academy';
import { toast } from '@/stores/toast';
import type { QuizAttemptAnswer, QuizAttemptResult } from '@/types/academy';
import { CoursePlayerShell } from '@/pages/academy/player/CoursePlayerShell';
import { LessonArticle } from '@/pages/academy/player/LessonArticle';
import { LessonFooter } from '@/pages/academy/player/LessonFooter';
import { QuizRunner } from '@/pages/academy/player/QuizRunner';
import { AcademyStatusCallout } from '@/pages/academy/components/AcademyStatusCallout';
import { StatusBadgeFromPresentation } from '@/pages/academy/components/StatusBadge';

/** External player — same shell as internal, no Bearer from TeamOS auth store. */
export function ExternalEnrollmentPlayerPage() {
  const { enrollmentId = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const lessonFromUrl = searchParams.get('lesson') ?? undefined;
  const queryClient = useQueryClient();
  const [quizResult, setQuizResult] = useState<QuizAttemptResult | null>(null);
  const [quizContinueLessonId, setQuizContinueLessonId] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const refetchedDeadline = useRef<string | null>(null);

  const enrollmentQuery = useQuery({
    queryKey: queryKeys.externalAcademy.enrollment(enrollmentId),
    queryFn: ({ signal }) => academyExternalPublicApi.getEnrollment(enrollmentId, { signal }),
    enabled: Boolean(enrollmentId),
  });

  const enrollment = enrollmentQuery.data;
  useTitle(enrollment ? `${enrollment.courseTitle} — Обучение` : 'Обучение');

  const outlineQuery = useQuery({
    queryKey: queryKeys.externalAcademy.outline(enrollmentId),
    queryFn: ({ signal }) => academyExternalPublicApi.getOutline(enrollmentId, { signal }),
    enabled: Boolean(enrollmentId),
  });
  const outline = outlineQuery.data;
  const refetchEnrollment = enrollmentQuery.refetch;
  const refetchOutline = outlineQuery.refetch;
  const flatLessons = useMemo(
    () => outline?.sections.flatMap((section) => section.lessons) ?? [],
    [outline],
  );

  useEffect(() => {
    if (!enrollment?.accessUntil) return;
    const timer = window.setInterval(() => setClockNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [enrollment?.accessUntil]);

  const deadlineExpired = Boolean(
    enrollment?.accessUntil && Date.parse(enrollment.accessUntil) <= clockNow,
  );

  useEffect(() => {
    if (!deadlineExpired || !enrollment?.accessUntil) return;
    if (refetchedDeadline.current === enrollment.accessUntil) return;
    refetchedDeadline.current = enrollment.accessUntil;
    void refetchEnrollment();
    void refetchOutline();
  }, [deadlineExpired, enrollment?.accessUntil, refetchEnrollment, refetchOutline]);

  useEffect(() => {
    if (!enrollment || !outline) return;
    const requested = flatLessons.find((lesson) => lesson.id === lessonFromUrl);
    const requestedAllowed = Boolean(
      requested &&
        (!requested.locked || requested.completed || requested.id === enrollment.currentLessonId),
    );
    if (requestedAllowed) return;

    const fallback =
      flatLessons.find((lesson) => lesson.id === enrollment.currentLessonId) ??
      flatLessons.find((lesson) => !lesson.locked || lesson.completed);
    setSearchParams(fallback ? { lesson: fallback.id } : {}, { replace: true });
  }, [enrollment, flatLessons, lessonFromUrl, outline, setSearchParams]);

  const currentLessonId = lessonFromUrl;
  const outlineLesson = flatLessons.find((lesson) => lesson.id === currentLessonId);
  const currentLessonAllowed = Boolean(
    outlineLesson &&
      (!outlineLesson.locked ||
        outlineLesson.completed ||
        outlineLesson.id === enrollment?.currentLessonId),
  );
  const lessonQuery = useQuery({
    queryKey: queryKeys.externalAcademy.lesson(enrollmentId, currentLessonId),
    queryFn: ({ signal }) =>
      academyExternalPublicApi.getLesson(enrollmentId, currentLessonId!, { signal }),
    enabled: Boolean(enrollmentId && currentLessonId && currentLessonAllowed),
  });

  useEffect(() => {
    setQuizResult(null);
    setQuizContinueLessonId(null);
  }, [currentLessonId]);

  const invalidatePlayerState = (lessonId: string | undefined) => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.externalAcademy.outline(enrollmentId),
    });
    if (lessonId) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.externalAcademy.lesson(enrollmentId, lessonId),
      });
    }
    void queryClient.invalidateQueries({
      queryKey: queryKeys.externalAcademy.results(enrollmentId),
    });
  };

  const completeMutation = useMutation({
    mutationFn: () => academyExternalPublicApi.completeLesson(enrollmentId, currentLessonId!),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.externalAcademy.enrollment(enrollmentId), updated);
      invalidatePlayerState(currentLessonId);
      toast.success('Урок завершён');
      if (updated.currentLessonId && updated.currentLessonId !== currentLessonId) {
        setSearchParams({ lesson: updated.currentLessonId });
      }
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Ошибка'),
  });

  const quizMutation = useMutation({
    mutationFn: (answers: QuizAttemptAnswer[]) =>
      academyExternalPublicApi.submitQuiz(enrollmentId, lessonQuery.data!.quiz!.id, { answers }),
    onSuccess: ({ attempt, enrollment: updated }) => {
      setQuizResult(attempt);
      queryClient.setQueryData(queryKeys.externalAcademy.enrollment(enrollmentId), updated);
      invalidatePlayerState(currentLessonId);
      if (attempt.passed) {
        toast.success(`Тест пройден · ${attempt.score}%`);
        setQuizContinueLessonId(
          updated.currentLessonId && updated.currentLessonId !== currentLessonId
            ? updated.currentLessonId
            : null,
        );
      } else if (attempt.pendingReview) {
        toast.info('Ответы отправлены на проверку');
      } else {
        toast.error(`Тест не пройден · ${attempt.score}%`);
      }
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Ошибка проверки'),
  });

  if (enrollmentQuery.isError || outlineQuery.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <AcademyStatusCallout
          tone="danger"
          title="Нет доступа"
          description="Сессия внешнего ученика недействительна или истекла."
        />
      </div>
    );
  }

  if (!enrollment || !outline) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Загрузка…
      </div>
    );
  }

  const remaining = deadlineRemaining(enrollment.accessUntil, clockNow);
  const readOnly =
    deadlineExpired ||
    !enrollment.canCompleteLessons ||
    enrollment.accessStatus === 'expired' ||
    enrollment.accessStatus === 'revoked' ||
    enrollment.accessStatus === 'frozen' ||
    enrollment.accessStatus === 'suspended' ||
    enrollment.accessStatus === 'closed';

  const lesson = lessonQuery.data;
  const hasQuiz = Boolean(lesson?.quiz);
  const lessonCompleted = Boolean(lesson?.completed || outlineLesson?.completed);
  const contentUnavailable =
    enrollment.accessStatus === 'suspended' ||
    enrollment.accessStatus === 'revoked' ||
    enrollment.accessStatus === 'closed' ||
    ((deadlineExpired || enrollment.accessStatus === 'expired') && !lessonCompleted);
  const visibleLesson = contentUnavailable ? null : lesson;
  const lessonIndex = flatLessons.findIndex((item) => item.id === currentLessonId);
  const prevLesson = lessonIndex > 0 ? flatLessons[lessonIndex - 1] : undefined;
  const nextLesson =
    lessonIndex >= 0 && lessonIndex < flatLessons.length - 1
      ? flatLessons[lessonIndex + 1]
      : undefined;
  const selectLesson = (lessonId: string) => {
    const target = flatLessons.find((item) => item.id === lessonId);
    if (!target || (target.locked && !target.completed && target.id !== enrollment.currentLessonId)) {
      toast.info('Сначала завершите предыдущий урок');
      return;
    }
    setSearchParams({ lesson: lessonId });
  };
  // Quiz completion is atomic via submitQuiz — never completeLesson for quiz lessons.
  const showComplete =
    !readOnly && lesson && !lesson.locked && !lessonCompleted && !hasQuiz;

  const accessCallout =
    deadlineExpired || enrollment.accessStatus === 'expired'
      ? {
          title: 'Срок прохождения истёк',
          description:
            'Завершённые уроки доступны, новый контент закрыт. Обратитесь к автору для продления.',
        }
      : enrollment.accessStatus === 'suspended'
        ? {
            title: 'Прохождение приостановлено',
            description: 'Ваш прогресс сохранён. Обратитесь к автору курса.',
          }
        : enrollment.accessStatus === 'closed'
          ? {
              title: 'Прохождение закрыто',
              description: 'Результаты сохранены, изменение прогресса недоступно.',
            }
          : enrollment.accessStatus === 'frozen'
            ? {
                title: 'Прохождение заморожено',
                description: 'Материалы доступны только для чтения.',
              }
            : enrollment.accessStatus === 'revoked'
              ? {
                  title: 'Доступ отозван',
                  description: 'Результаты сохранены. Обратитесь к автору курса.',
                }
              : null;

  return (
    <CoursePlayerShell
      mode="external"
      title={enrollment.courseTitle}
      percent={enrollment.percent}
      headerLeft={
        <Link to={academyRoutes.externalResults(enrollmentId)}>
          <Button size="sm" variant="ghost">
            Результаты
          </Button>
        </Link>
      }
      headerMeta={
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadgeFromPresentation status={enrollmentAccessLabel(enrollment.accessStatus)} />
          {remaining ? (
            <span className="text-xs font-medium text-slate-600">
              {remaining.expired
                ? remaining.label
                : `Доступ до ${formatAccessUntil(enrollment.accessUntil!)} · осталось ${remaining.label}`}
            </span>
          ) : null}
        </div>
      }
      outline={outline}
      currentLessonId={currentLessonId}
      onSelectLesson={selectLesson}
      callout={
        accessCallout ? (
          <AcademyStatusCallout
            tone="warning"
            title={accessCallout.title}
            description={accessCallout.description}
          />
        ) : null
      }
      content={
        <div>
          <LessonArticle lesson={visibleLesson} loading={lessonQuery.isLoading} />
          {visibleLesson?.quiz && !visibleLesson.locked ? (
            <QuizRunner
              quiz={visibleLesson.quiz}
              disabled={readOnly || !enrollment.canSubmitQuiz || lessonCompleted}
              submitting={quizMutation.isPending}
              lastResult={quizResult}
              onSubmit={(a) => quizMutation.mutate(a)}
              onRetry={() => {
                setQuizResult(null);
                setQuizContinueLessonId(null);
              }}
              onContinue={
                quizResult?.passed
                  ? () => {
                      if (quizContinueLessonId) selectLesson(quizContinueLessonId);
                      else navigate(academyRoutes.externalResults(enrollmentId));
                    }
                  : undefined
              }
            />
          ) : null}
        </div>
      }
      footer={
        <LessonFooter
          canGoPrev={Boolean(prevLesson && (!prevLesson.locked || prevLesson.completed))}
          canGoNext={Boolean(nextLesson && (!nextLesson.locked || nextLesson.completed))}
          onPrev={() => prevLesson && selectLesson(prevLesson.id)}
          onNext={() => nextLesson && selectLesson(nextLesson.id)}
          showComplete={Boolean(showComplete)}
          completeLabel="Завершить и продолжить"
          completeLoading={completeMutation.isPending}
          onComplete={() => completeMutation.mutate()}
        />
      }
    />
  );
}

export function ExternalResultsPage() {
  const { enrollmentId = '' } = useParams();
  useTitle('Результаты — TeamOS');

  const resultsQuery = useQuery({
    queryKey: queryKeys.externalAcademy.results(enrollmentId),
    queryFn: ({ signal }) => academyExternalPublicApi.getResults(enrollmentId, { signal }),
    enabled: Boolean(enrollmentId),
  });

  if (resultsQuery.isError) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 p-6">
        <AcademyStatusCallout
          tone="danger"
          title="Не удалось открыть результаты"
          description="Сессия недействительна либо результаты этого прохождения недоступны."
        />
        <Link to={academyRoutes.externalPlayer(enrollmentId)}>
          <Button variant="secondary">Вернуться к курсу</Button>
        </Link>
      </div>
    );
  }

  const results = resultsQuery.data;
  if (!results) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Загружаем результаты…
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl space-y-6 p-6">
      <div>
        <p className="text-sm text-slate-500">{results.enrollment.courseTitle}</p>
        <h1 className="text-2xl font-semibold text-slate-950">Результаты прохождения</h1>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <ResultMetric label="Прогресс" value={`${results.enrollment.percent}%`} />
        <ResultMetric
          label="Уроки"
          value={`${results.enrollment.completedLessons} / ${results.enrollment.totalLessons}`}
        />
        <ResultMetric label="Попытки" value={String(results.quizAttempts.length)} />
      </div>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-surface">
        <h2 className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-900">Уроки</h2>
        <ul className="divide-y divide-slate-100">
          {results.lessonResults.map((lesson) => (
            <li
              key={lesson.lessonId}
              className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
            >
              <span className="text-slate-900">{lesson.title}</span>
              <span className={lesson.completed ? 'text-success-700' : 'text-slate-500'}>
                {lesson.quizScore != null
                  ? `${lesson.quizScore}% · ${lesson.quizPassed ? 'пройден' : 'не пройден'}`
                  : lesson.completed
                    ? 'Завершён'
                    : 'Не завершён'}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <Link to={academyRoutes.externalPlayer(enrollmentId)}>
        <Button variant="secondary">Вернуться к курсу</Button>
      </Link>
    </div>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-surface p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function formatAccessUntil(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
