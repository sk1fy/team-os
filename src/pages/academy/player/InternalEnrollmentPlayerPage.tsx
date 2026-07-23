import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { ArrowLeft, PanelLeft } from 'lucide-react';
import { academyLearningApi } from '@/api/academy';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { Button } from '@/components/ui';
import {
  academyRoutes,
  enrollmentAccessLabel,
  enrollmentProgressLabel,
} from '@/lib/academy';
import { toast } from '@/stores/toast';
import type {
  EnrollmentDetail,
  LessonLearner,
  QuizAttemptAnswer,
  QuizAttemptResult,
} from '@/types/academy';
import { StatusBadgeFromPresentation } from '../components/StatusBadge';
import { AcademyStatusCallout } from '../components/AcademyStatusCallout';
import { CoursePlayerShell } from './CoursePlayerShell';
import { LessonArticle } from './LessonArticle';
import { LessonFooter } from './LessonFooter';
import { QuizRunner } from './QuizRunner';

function flattenLessons(enrollment: EnrollmentDetail) {
  return enrollment.outline.sections
    .slice()
    .sort((a, b) => a.order - b.order)
    .flatMap((section) =>
      section.lessons
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((lesson) => ({ ...lesson, sectionId: section.id })),
    );
}

function blocksAllLessonContent(enrollment: EnrollmentDetail): boolean {
  return (
    enrollment.accessStatus === 'suspended' ||
    enrollment.accessStatus === 'revoked' ||
    enrollment.accessStatus === 'closed'
  );
}

function canReadOutlineLesson(
  enrollment: EnrollmentDetail,
  lesson: ReturnType<typeof flattenLessons>[number],
): boolean {
  if (blocksAllLessonContent(enrollment)) return false;
  if (enrollment.accessStatus === 'expired') return lesson.completed;
  return !lesson.locked || lesson.completed;
}

function firstAvailableLessonId(enrollment: EnrollmentDetail): string | undefined {
  const lessons = flattenLessons(enrollment);
  return (
    lessons.find((lesson) => canReadOutlineLesson(enrollment, lesson) && !lesson.completed)?.id ??
    lessons.find((lesson) => canReadOutlineLesson(enrollment, lesson))?.id
  );
}

function nextAvailableLessonId(
  enrollment: EnrollmentDetail,
  currentLessonId: string | undefined,
): string | undefined {
  if (enrollment.currentLessonId && enrollment.currentLessonId !== currentLessonId) {
    const serverCurrent = flattenLessons(enrollment).find(
      (lesson) => lesson.id === enrollment.currentLessonId && !lesson.locked,
    );
    if (serverCurrent) return serverCurrent.id;
  }
  const lessons = flattenLessons(enrollment);
  const currentIndex = lessons.findIndex((lesson) => lesson.id === currentLessonId);
  return lessons.slice(currentIndex + 1).find((lesson) => !lesson.locked)?.id;
}

export function InternalEnrollmentPlayerPage() {
  const { enrollmentId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const lessonFromUrl = searchParams.get('lesson') ?? undefined;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [quizResult, setQuizResult] = useState<QuizAttemptResult | null>(null);
  const [quizContinueLessonId, setQuizContinueLessonId] = useState<string | null>(null);

  const enrollmentQuery = useQuery({
    queryKey: queryKeys.academyV2.enrollment(enrollmentId),
    queryFn: ({ signal }) => academyLearningApi.getEnrollment(enrollmentId, { signal }),
    enabled: Boolean(enrollmentId),
  });

  const enrollment = enrollmentQuery.data;
  useTitle(
    enrollment ? `${enrollment.courseTitle} — Обучение — TeamOS` : 'Обучение — TeamOS',
  );

  const flatLessons = useMemo(
    () => (enrollment ? flattenLessons(enrollment) : []),
    [enrollment],
  );

  // Resume algorithm: URL if available → server current → first available
  useEffect(() => {
    if (!enrollment) return;
    const lessons = flattenLessons(enrollment);
    const urlLesson = lessonFromUrl
      ? lessons.find((l) => l.id === lessonFromUrl)
      : undefined;

    let targetId: string | undefined;
    if (urlLesson && canReadOutlineLesson(enrollment, urlLesson)) {
      targetId = urlLesson.id;
    } else if (enrollment.currentLessonId) {
      const serverLesson = lessons.find((l) => l.id === enrollment.currentLessonId);
      if (serverLesson && canReadOutlineLesson(enrollment, serverLesson)) {
        targetId = serverLesson.id;
      }
    }
    if (!targetId) targetId = firstAvailableLessonId(enrollment);

    if (targetId && lessonFromUrl !== targetId) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('lesson', targetId!);
          return next;
        },
        { replace: true },
      );
    } else if (!targetId && lessonFromUrl) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('lesson');
          return next;
        },
        { replace: true },
      );
    }
  }, [enrollment, lessonFromUrl, setSearchParams]);

  const currentLessonId = lessonFromUrl;
  const outlineLesson = flatLessons.find((l) => l.id === currentLessonId);
  const canReadCurrentLesson = Boolean(
    enrollment && outlineLesson && canReadOutlineLesson(enrollment, outlineLesson),
  );

  const lessonQuery = useQuery({
    queryKey: queryKeys.academyV2.enrollmentLesson(enrollmentId, currentLessonId),
    queryFn: ({ signal }) =>
      academyLearningApi.getLesson(enrollmentId, currentLessonId!, { signal }),
    enabled: Boolean(enrollmentId && currentLessonId && canReadCurrentLesson),
  });

  const lesson: LessonLearner | null | undefined = canReadCurrentLesson
    ? lessonQuery.data
    : undefined;

  useEffect(() => {
    setQuizResult(null);
    setQuizContinueLessonId(null);
  }, [currentLessonId]);

  const selectLesson = (lessonId: string) => {
    const target = flatLessons.find((l) => l.id === lessonId);
    if (!enrollment || !target || !canReadOutlineLesson(enrollment, target)) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('lesson', lessonId);
        return next;
      },
      { replace: false },
    );
  };

  const lessonIndex = flatLessons.findIndex((l) => l.id === currentLessonId);
  const prevLesson = lessonIndex > 0 ? flatLessons[lessonIndex - 1] : undefined;
  const nextLesson =
    lessonIndex >= 0 && lessonIndex < flatLessons.length - 1
      ? flatLessons[lessonIndex + 1]
      : undefined;

  const applyEnrollmentUpdate = (updated: EnrollmentDetail) => {
    queryClient.setQueryData(queryKeys.academyV2.enrollment(enrollmentId), updated);
    void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.myLearning });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.academyV2.enrollmentLesson(enrollmentId, currentLessonId),
    });
  };

  const completeMutation = useMutation({
    mutationFn: () => academyLearningApi.completeLesson(enrollmentId, currentLessonId!),
    onSuccess: (updated) => {
      applyEnrollmentUpdate(updated);
      toast.success(
        updated.progressStatus === 'completed'
          ? 'Курс завершён!'
          : 'Урок отмечен как пройденный',
      );
      const nextId = nextAvailableLessonId(updated, currentLessonId);
      if (nextId) selectLesson(nextId);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Не удалось завершить урок');
    },
  });

  const quizMutation = useMutation({
    mutationFn: (answers: QuizAttemptAnswer[]) =>
      academyLearningApi.submitQuiz(enrollmentId, lesson!.quiz!.id, { answers }),
    onSuccess: ({ attempt, enrollment: updated }) => {
      // Atomic server payload: attempt + enrollment (completion/unlock) in one response.
      setQuizResult(attempt);
      applyEnrollmentUpdate(updated);
      if (attempt.passed) {
        toast.success(`Тест пройден · ${attempt.score}%`);
        // Keep inline feedback visible; navigation happens only after explicit user action.
        setQuizContinueLessonId(nextAvailableLessonId(updated, currentLessonId) ?? null);
      } else if (attempt.pendingReview) {
        toast.info('Ответы отправлены на проверку');
      } else {
        toast.error(`Тест не пройден · ${attempt.score}%`);
      }
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Не удалось проверить ответы');
    },
  });

  if (enrollmentQuery.isError) {
    const status = enrollmentQuery.error instanceof ApiError ? enrollmentQuery.error.status : 0;
    return (
      <div className="flex min-h-screen items-center justify-center bg-page p-6">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-lg font-semibold text-slate-900">
            {status === 403
              ? 'Недостаточно прав'
              : status === 404
                ? 'Прохождение не найдено'
                : 'Ошибка загрузки'}
          </h1>
          <p className="text-sm text-slate-500">
            Не удалось открыть enrollment. Вернитесь к списку обучения.
          </p>
          <Link to={academyRoutes.home}>
            <Button>К моему обучению</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (enrollmentQuery.isLoading || !enrollment) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page text-sm text-slate-500">
        Загружаем прохождение…
      </div>
    );
  }

  const access = enrollmentAccessLabel(enrollment.accessStatus);
  const progress = enrollmentProgressLabel(enrollment.progressStatus);

  const readOnly =
    !enrollment.canCompleteLessons ||
    enrollment.accessStatus === 'expired' ||
    enrollment.accessStatus === 'frozen' ||
    enrollment.accessStatus === 'suspended' ||
    enrollment.accessStatus === 'revoked' ||
    enrollment.accessStatus === 'closed' ||
    enrollment.isPreview;

  const hasQuiz = Boolean(lesson?.quiz);
  const lessonCompleted = Boolean(lesson?.completed || outlineLesson?.completed);
  // Quiz lessons complete via submitQuiz atomic response — never completeLesson bypass.
  const quizBlocksComplete = hasQuiz && !lessonCompleted;

  const showComplete =
    !readOnly &&
    !lessonCompleted &&
    Boolean(lesson && !lesson.locked) &&
    enrollment.canCompleteLessons &&
    !hasQuiz;

  const completeLabel =
    nextLesson && !nextLesson.locked ? 'Завершить и продолжить' : 'Завершить урок';

  return (
    <CoursePlayerShell
      mode={enrollment.isPreview ? 'preview' : 'internal'}
      title={enrollment.courseTitle}
      percent={enrollment.percent}
      headerLeft={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(academyRoutes.home)}
          aria-label="Назад к обучению"
        >
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">Назад</span>
        </Button>
      }
      headerMeta={
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadgeFromPresentation status={progress} />
          <StatusBadgeFromPresentation status={access} />
        </div>
      }
      outline={enrollment.outline}
      outlineReadOnly={blocksAllLessonContent(enrollment)}
      currentLessonId={currentLessonId}
      onSelectLesson={selectLesson}
      outlineToggleIcon={<PanelLeft className="size-4" />}
      callout={
        enrollment.stateMessage ? (
          <AcademyStatusCallout
            tone="warning"
            title="Ограниченный режим"
            description={enrollment.stateMessage}
          />
        ) : enrollment.accessStatus === 'expired' ? (
          <AcademyStatusCallout
            tone="warning"
            title="Срок прохождения истёк"
            description="Завершённые уроки и результаты остаются доступны, новый контент закрыт."
          />
        ) : null
      }
      content={
        <div>
          {blocksAllLessonContent(enrollment) ? (
            <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
              <AcademyStatusCallout
                tone="warning"
                title="Материалы недоступны"
                description="Контент курса скрыт, но сохранённый результат прохождения не удалён."
              />
            </div>
          ) : enrollment.accessStatus === 'expired' && !outlineLesson?.completed ? (
            <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
              <AcademyStatusCallout
                tone="warning"
                title="Урок недоступен"
                description="После окончания срока можно открыть только завершённые уроки."
              />
            </div>
          ) : (
            <LessonArticle
              lesson={lesson}
              loading={Boolean(currentLessonId && canReadCurrentLesson && lessonQuery.isLoading)}
            />
          )}
          {lesson?.quiz && !lesson.locked ? (
            <QuizRunner
              quiz={lesson.quiz}
              disabled={readOnly || !enrollment.canSubmitQuiz || lessonCompleted}
              submitting={quizMutation.isPending}
              lastResult={quizResult}
              onSubmit={(answers) => quizMutation.mutate(answers)}
              onRetry={() => setQuizResult(null)}
              onContinue={
                quizResult?.passed && quizContinueLessonId
                  ? () => selectLesson(quizContinueLessonId)
                  : undefined
              }
            />
          ) : null}
          {quizBlocksComplete && !readOnly ? (
            <div className="mx-auto max-w-3xl px-4 pb-4 sm:px-6">
              <AcademyStatusCallout
                tone="info"
                title="Сначала пройдите тест"
                description="Урок с проверкой знаний нельзя завершить без успешной попытки на сервере."
              />
            </div>
          ) : null}
        </div>
      }
      footer={
        <LessonFooter
          canGoPrev={Boolean(prevLesson && canReadOutlineLesson(enrollment, prevLesson))}
          canGoNext={Boolean(nextLesson && canReadOutlineLesson(enrollment, nextLesson))}
          onPrev={() => prevLesson && selectLesson(prevLesson.id)}
          onNext={() => nextLesson && selectLesson(nextLesson.id)}
          showComplete={showComplete}
          completeLabel={completeLabel}
          completeDisabled={completeMutation.isPending}
          completeLoading={completeMutation.isPending}
          onComplete={() => completeMutation.mutate()}
        />
      }
    />
  );
}

/**
 * Entry for /learn/:id when V2 is on.
 * 1) Treat id as enrollmentId (canonical).
 * 2) On 404, treat id as legacy courseId and resolve → replace with enrollment URL.
 * Also used for /learn-opus/:courseId and /learn-grok/:courseId redirects.
 */
export function LearnRouteEntry() {
  const { enrollmentId: id = '' } = useParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'enrollment' | 'resolve' | 'player'>('enrollment');

  const enrollmentProbe = useQuery({
    queryKey: queryKeys.academyV2.enrollment(id),
    queryFn: ({ signal }) => academyLearningApi.getEnrollment(id, { signal }),
    enabled: Boolean(id) && mode === 'enrollment',
    retry: false,
  });

  useEffect(() => {
    if (mode !== 'enrollment') return;
    if (enrollmentProbe.isSuccess) {
      setMode('player');
      return;
    }
    if (enrollmentProbe.isError) {
      const status =
        enrollmentProbe.error instanceof ApiError ? enrollmentProbe.error.status : 0;
      // 404 → try legacy courseId resolution; other errors stay on player error UI
      if (status === 404) setMode('resolve');
      else setMode('player');
    }
  }, [mode, enrollmentProbe.isSuccess, enrollmentProbe.isError, enrollmentProbe.error]);

  const resolveQuery = useQuery({
    queryKey: ['academy-v2', 'resolve-enrollment', id],
    queryFn: ({ signal }) => academyLearningApi.resolveEnrollmentForCourse(id, { signal }),
    enabled: Boolean(id) && mode === 'resolve',
    retry: false,
  });

  useEffect(() => {
    if (resolveQuery.data?.enrollmentId) {
      navigate(academyRoutes.learn(resolveQuery.data.enrollmentId), { replace: true });
    }
  }, [navigate, resolveQuery.data?.enrollmentId]);

  if (mode === 'enrollment' && enrollmentProbe.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page text-sm text-slate-500">
        Загружаем прохождение…
      </div>
    );
  }

  if (mode === 'resolve') {
    if (resolveQuery.isError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-page p-6">
          <div className="max-w-md space-y-4 text-center">
            <h1 className="text-lg font-semibold">Не удалось открыть курс</h1>
            <p className="text-sm text-slate-500">
              Нет активного прохождения для этого курса. Откройте «Моё обучение» или каталог.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link to={academyRoutes.home}>
                <Button>Моё обучение</Button>
              </Link>
              <Link to={academyRoutes.catalog}>
                <Button variant="secondary">Каталог</Button>
              </Link>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-page text-sm text-slate-500">
        Ищем прохождение по курсу…
      </div>
    );
  }

  // Player mode (enrollment exists or non-404 error handled inside player)
  return <InternalEnrollmentPlayerPage />;
}

/** @deprecated Prefer LearnRouteEntry on /learn/:id */
export function LegacyCourseEnrollmentResolver() {
  const { courseId = '' } = useParams();
  const navigate = useNavigate();

  const resolveQuery = useQuery({
    queryKey: ['academy-v2', 'resolve-enrollment', courseId],
    queryFn: ({ signal }) => academyLearningApi.resolveEnrollmentForCourse(courseId, { signal }),
    enabled: Boolean(courseId),
    retry: false,
  });

  useEffect(() => {
    if (resolveQuery.data?.enrollmentId) {
      navigate(academyRoutes.learn(resolveQuery.data.enrollmentId), { replace: true });
    }
  }, [navigate, resolveQuery.data?.enrollmentId]);

  if (resolveQuery.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page p-6">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-lg font-semibold">Не удалось открыть курс</h1>
          <p className="text-sm text-slate-500">
            Нет активного прохождения для этого курса. Откройте «Моё обучение».
          </p>
          <Link to={academyRoutes.home}>
            <Button>К моему обучению</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-page text-sm text-slate-500">
      Открываем прохождение…
    </div>
  );
}
