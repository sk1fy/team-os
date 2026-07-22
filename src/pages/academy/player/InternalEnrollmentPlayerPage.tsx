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

function firstAvailableLessonId(enrollment: EnrollmentDetail): string | undefined {
  const lessons = flattenLessons(enrollment);
  return (
    lessons.find((l) => !l.locked && !l.completed)?.id ??
    lessons.find((l) => !l.locked)?.id ??
    lessons[0]?.id
  );
}

export function InternalEnrollmentPlayerPage() {
  const { enrollmentId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const lessonFromUrl = searchParams.get('lesson') ?? undefined;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [quizResult, setQuizResult] = useState<QuizAttemptResult | null>(null);

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
    if (urlLesson && !urlLesson.locked) {
      targetId = urlLesson.id;
    } else if (enrollment.currentLessonId) {
      const serverLesson = lessons.find((l) => l.id === enrollment.currentLessonId);
      if (serverLesson && !serverLesson.locked) targetId = serverLesson.id;
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
    }
  }, [enrollment, lessonFromUrl, setSearchParams]);

  const currentLessonId = lessonFromUrl;
  const outlineLesson = flatLessons.find((l) => l.id === currentLessonId);

  const lessonQuery = useQuery({
    queryKey: queryKeys.academyV2.enrollmentLesson(enrollmentId, currentLessonId),
    queryFn: ({ signal }) =>
      academyLearningApi.getLesson(enrollmentId, currentLessonId!, { signal }),
    enabled: Boolean(enrollmentId && currentLessonId && outlineLesson && !outlineLesson.locked),
  });

  const lesson: LessonLearner | null | undefined = outlineLesson?.locked
    ? ({
        id: outlineLesson.id,
        courseId: enrollment?.courseId ?? '',
        sectionId: outlineLesson.sectionId,
        versionId: enrollment?.courseVersionId ?? '',
        title: outlineLesson.title,
        order: outlineLesson.order,
        content: { type: 'doc', content: [] },
        locked: true,
        completed: outlineLesson.completed,
      } satisfies LessonLearner)
    : lessonQuery.data;

  useEffect(() => {
    setQuizResult(null);
  }, [currentLessonId]);

  const selectLesson = (lessonId: string) => {
    const target = flatLessons.find((l) => l.id === lessonId);
    if (target?.locked) return;
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
      const nextId =
        updated.currentLessonId && updated.currentLessonId !== currentLessonId
          ? updated.currentLessonId
          : nextLesson && !nextLesson.locked
            ? nextLesson.id
            : undefined;
      if (nextId) selectLesson(nextId);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Не удалось завершить урок');
    },
  });

  const quizMutation = useMutation({
    mutationFn: (answers: QuizAttemptAnswer[]) =>
      academyLearningApi.submitQuiz(enrollmentId, lesson!.quiz!.id, { answers }),
    onSuccess: (result) => {
      setQuizResult(result);
      // Atomic enrollment refresh after grade (unlock / completion flags)
      void queryClient.invalidateQueries({
        queryKey: queryKeys.academyV2.enrollment(enrollmentId),
      });
      if (result.passed) {
        toast.success(`Тест пройден · ${result.score}%`);
      } else if (result.pendingReview) {
        toast.info('Ответы отправлены на проверку');
      } else {
        toast.error(`Тест не пройден · ${result.score}%`);
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
  const quizPassed = Boolean(quizResult?.passed);
  const quizBlocksComplete = hasQuiz && !lessonCompleted && !quizPassed;

  const showComplete =
    !readOnly &&
    !lessonCompleted &&
    Boolean(lesson && !lesson.locked) &&
    enrollment.canCompleteLessons &&
    (!hasQuiz || quizPassed);

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
          <LessonArticle
            lesson={lesson}
            loading={Boolean(currentLessonId && !outlineLesson?.locked && lessonQuery.isLoading)}
          />
          {lesson?.quiz && !lesson.locked ? (
            <QuizRunner
              quiz={lesson.quiz}
              disabled={readOnly || !enrollment.canSubmitQuiz || lessonCompleted}
              submitting={quizMutation.isPending}
              lastResult={quizResult}
              onSubmit={(answers) => quizMutation.mutate(answers)}
              onRetry={() => setQuizResult(null)}
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
          canGoPrev={Boolean(prevLesson && !prevLesson.locked)}
          canGoNext={Boolean(nextLesson && !nextLesson.locked)}
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

/** Legacy /learn-legacy/:courseId → resolve enrollment → replace. */
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
