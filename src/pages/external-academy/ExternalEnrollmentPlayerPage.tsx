import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const lessonFromUrl = searchParams.get('lesson') ?? undefined;
  const queryClient = useQueryClient();
  const [quizResult, setQuizResult] = useState<QuizAttemptResult | null>(null);

  const enrollmentQuery = useQuery({
    queryKey: queryKeys.externalAcademy.enrollment(enrollmentId),
    queryFn: ({ signal }) => academyExternalPublicApi.getEnrollment(enrollmentId, { signal }),
    enabled: Boolean(enrollmentId),
  });

  const enrollment = enrollmentQuery.data;
  useTitle(enrollment ? `${enrollment.courseTitle} — Обучение` : 'Обучение');

  useEffect(() => {
    if (!enrollment || lessonFromUrl) return;
    if (enrollment.currentLessonId) {
      setSearchParams({ lesson: enrollment.currentLessonId }, { replace: true });
    }
  }, [enrollment, lessonFromUrl, setSearchParams]);

  const currentLessonId = lessonFromUrl;
  const lessonQuery = useQuery({
    queryKey: queryKeys.externalAcademy.lesson(enrollmentId, currentLessonId),
    queryFn: ({ signal }) =>
      academyExternalPublicApi.getLesson(enrollmentId, currentLessonId!, { signal }),
    enabled: Boolean(enrollmentId && currentLessonId),
  });

  useEffect(() => setQuizResult(null), [currentLessonId]);

  const completeMutation = useMutation({
    mutationFn: () => academyExternalPublicApi.completeLesson(enrollmentId, currentLessonId!),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.externalAcademy.enrollment(enrollmentId), updated);
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
      if (attempt.passed) {
        toast.success(`Тест пройден · ${attempt.score}%`);
        if (updated.currentLessonId && updated.currentLessonId !== currentLessonId) {
          setSearchParams({ lesson: updated.currentLessonId });
        }
      } else if (attempt.pendingReview) {
        toast.info('Ответы отправлены на проверку');
      } else {
        toast.error(`Тест не пройден · ${attempt.score}%`);
      }
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Ошибка проверки'),
  });

  if (enrollmentQuery.isError) {
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

  if (!enrollment) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Загрузка…
      </div>
    );
  }

  const remaining = deadlineRemaining(enrollment.accessUntil);
  const readOnly =
    !enrollment.canCompleteLessons ||
    enrollment.accessStatus === 'expired' ||
    enrollment.accessStatus === 'revoked' ||
    enrollment.accessStatus === 'frozen';

  const lesson = lessonQuery.data;
  const hasQuiz = Boolean(lesson?.quiz);
  // Quiz completion is atomic via submitQuiz — never completeLesson for quiz lessons.
  const showComplete =
    !readOnly && lesson && !lesson.locked && !lesson.completed && !hasQuiz;

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
              {remaining.expired ? remaining.label : `Осталось ${remaining.label}`}
            </span>
          ) : null}
        </div>
      }
      outline={enrollment.outline}
      currentLessonId={currentLessonId}
      onSelectLesson={(id) => setSearchParams({ lesson: id })}
      callout={
        remaining?.expired ? (
          <AcademyStatusCallout
            tone="warning"
            title="Срок прохождения истёк"
            description="Завершённые уроки доступны, новый контент закрыт. Обратитесь к автору для продления."
          />
        ) : null
      }
      content={
        <div>
          <LessonArticle lesson={lesson} loading={lessonQuery.isLoading} />
          {lesson?.quiz && !lesson.locked ? (
            <QuizRunner
              quiz={lesson.quiz}
              disabled={readOnly || !enrollment.canSubmitQuiz || lesson.completed}
              submitting={quizMutation.isPending}
              lastResult={quizResult}
              onSubmit={(a) => quizMutation.mutate(a)}
              onRetry={() => setQuizResult(null)}
            />
          ) : null}
        </div>
      }
      footer={
        <LessonFooter
          canGoPrev={false}
          canGoNext={false}
          onPrev={() => undefined}
          onNext={() => undefined}
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

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">Результаты прохождения</h1>
      <p className="text-sm text-slate-500">
        Детальный enrollment report для внешнего ученика (enrollment {enrollmentId}).
      </p>
      <Link to={academyRoutes.externalPlayer(enrollmentId)}>
        <Button variant="secondary">Вернуться к курсу</Button>
      </Link>
    </div>
  );
}
