import { useEffect } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { ArrowLeft, PanelLeft } from 'lucide-react';
import { academyLearningApi } from '@/api/academy';
import { queryKeys } from '@/api/queryKeys';
import { Button } from '@/components/ui';
import { academyRoutes, enrollmentAccessLabel, enrollmentProgressLabel } from '@/lib/academy';
import { StatusBadgeFromPresentation } from '../components/StatusBadge';
import { AcademyStatusCallout } from '../components/AcademyStatusCallout';
import { CoursePlayerShell } from './CoursePlayerShell';

export function InternalEnrollmentPlayerPage() {
  const { enrollmentId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const lessonFromUrl = searchParams.get('lesson') ?? undefined;
  const navigate = useNavigate();

  const enrollmentQuery = useQuery({
    queryKey: queryKeys.academyV2.enrollment(enrollmentId),
    queryFn: ({ signal }) => academyLearningApi.getEnrollment(enrollmentId, { signal }),
    enabled: Boolean(enrollmentId),
  });

  const enrollment = enrollmentQuery.data;
  useTitle(
    enrollment ? `${enrollment.courseTitle} — Обучение — TeamOS` : 'Обучение — TeamOS',
  );

  // Resume: if URL has no lesson, set server currentLessonId
  useEffect(() => {
    if (!enrollment || lessonFromUrl) return;
    if (enrollment.currentLessonId) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('lesson', enrollment.currentLessonId!);
          return next;
        },
        { replace: true },
      );
    }
  }, [enrollment, lessonFromUrl, setSearchParams]);

  if (enrollmentQuery.isError) {
    const status = (enrollmentQuery.error as { status?: number })?.status;
    return (
      <div className="flex min-h-screen items-center justify-center bg-page p-6">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-lg font-semibold text-slate-900">
            {status === 403 ? 'Недостаточно прав' : status === 404 ? 'Прохождение не найдено' : 'Ошибка загрузки'}
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
  const currentLessonId = lessonFromUrl ?? enrollment.currentLessonId;

  const readOnly =
    !enrollment.canCompleteLessons ||
    enrollment.accessStatus === 'expired' ||
    enrollment.accessStatus === 'frozen' ||
    enrollment.accessStatus === 'suspended' ||
    enrollment.accessStatus === 'revoked' ||
    enrollment.accessStatus === 'closed';

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
      onSelectLesson={(lessonId) => {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.set('lesson', lessonId);
            return next;
          },
          { replace: false },
        );
      }}
      outlineToggleIcon={<PanelLeft className="size-4" />}
      callout={
        readOnly && enrollment.stateMessage ? (
          <AcademyStatusCallout
            tone="warning"
            title="Ограниченный режим"
            description={enrollment.stateMessage}
          />
        ) : enrollment.accessStatus === 'expired' ? (
          <AcademyStatusCallout
            tone="warning"
            title="Срок доступа истёк"
            description="Завершённые уроки и результаты остаются доступны, новый контент закрыт."
          />
        ) : null
      }
      content={
        <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
          <p className="text-sm text-slate-500">
            Урок: {currentLessonId ?? 'не выбран'} · quiz/complete UI — Phase 2
          </p>
          <p className="text-sm text-slate-600">
            Player shell использует enrollmentId (не courseId). Контент урока и QuizRunner
            подключаются к read models backend.
          </p>
        </div>
      }
    />
  );
}

/** Legacy /learn/:courseId → resolve enrollment → replace. */
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
