import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import {
  ArrowRight,
  Award,
  BookOpenCheck,
  Clock3,
  PlayCircle,
  Sparkles,
  Target,
} from 'lucide-react';
import { httpAcademyApi, httpAuthApi, httpOrgApi } from '@/api/http';
import { queryKeys } from '@/api/queryKeys';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { Button } from '@/components/ui';
import { canManageContent } from '@/lib/permissions';
import { plural } from '@/lib/format';
import { AcademyGrokNav } from './components/AcademyGrokNav';
import { GrokCourseCard } from './components/GrokCourseCard';
import { ProgressBar } from './components/ProgressBar';
import { courseCoverClass, progressPercent, resolveMyCourseIds, userProgressFor } from './utils';
import type { Course, CourseAssignment, CourseProgress, Lesson } from '@/types';

const emptyCourses: Course[] = [];
const emptyLessons: Lesson[] = [];
const emptyProgress: CourseProgress[] = [];
const emptyAssignments: CourseAssignment[] = [];

export function AcademyGrokHomePage() {
  useTitle('Академия Grok — TeamOS');

  const currentUserQuery = useQuery({
    queryKey: queryKeys.academyGrok.currentUser,
    queryFn: httpAuthApi.getCurrentUser,
  });
  const coursesQuery = useQuery({
    queryKey: queryKeys.academyGrok.courses,
    queryFn: httpAcademyApi.getCourses,
  });
  const lessonsQuery = useQuery({
    queryKey: queryKeys.academyGrok.lessons,
    queryFn: () => httpAcademyApi.getLessons(),
  });
  const progressQuery = useQuery({
    queryKey: queryKeys.academyGrok.progress,
    queryFn: () => httpAcademyApi.getProgress(),
  });
  const assignmentsQuery = useQuery({
    queryKey: queryKeys.academyGrok.assignments,
    queryFn: httpAcademyApi.getAssignments,
  });
  const positionsQuery = useQuery({
    queryKey: queryKeys.academyGrok.positions,
    queryFn: httpOrgApi.getPositions,
  });

  const currentUser = currentUserQuery.data;
  const canManage = canManageContent(currentUser?.role);
  const courses = coursesQuery.data ?? emptyCourses;
  const lessons = lessonsQuery.data ?? emptyLessons;
  const progress = progressQuery.data ?? emptyProgress;
  const assignments = assignmentsQuery.data ?? emptyAssignments;

  const myCourseIds = useMemo(
    () =>
      resolveMyCourseIds({
        courses,
        assignments,
        progress,
        user: currentUser,
        positions: positionsQuery.data ?? [],
      }),
    [assignments, courses, currentUser, positionsQuery.data, progress],
  );

  const myCourses = useMemo(() => {
    return courses
      .filter((course) => myCourseIds.has(course.id) && course.status === 'published')
      .map((course) => {
        const itemProgress = userProgressFor(progress, currentUser?.id, course.id);
        const courseLessons = lessons.filter((lesson) => lesson.courseId === course.id);
        const percent = progressPercent(courseLessons, itemProgress);
        return { course, progress: itemProgress, lessons: courseLessons, percent };
      })
      .sort((a, b) => {
        const rank = (status?: string) =>
          status === 'in_progress' || status === 'overdue'
            ? 0
            : status === 'not_started' || !status
              ? 1
              : 2;
        return rank(a.progress?.status) - rank(b.progress?.status) || b.percent - a.percent;
      });
  }, [courses, currentUser?.id, lessons, myCourseIds, progress]);

  const continueItem =
    myCourses.find(
      (item) => item.progress?.status === 'in_progress' || (item.percent > 0 && item.percent < 100),
    ) ?? myCourses.find((item) => !item.progress || item.progress.status === 'not_started');

  const completedCount = myCourses.filter(
    (item) => item.progress?.status === 'completed' || item.percent >= 100,
  ).length;
  const inProgressCount = myCourses.filter(
    (item) => item.progress?.status === 'in_progress' || (item.percent > 0 && item.percent < 100),
  ).length;
  const avgProgress =
    myCourses.length === 0
      ? 0
      : Math.round(myCourses.reduce((sum, item) => sum + item.percent, 0) / myCourses.length);

  const catalogPreview = courses
    .filter((course) => course.status === 'published' && !myCourseIds.has(course.id))
    .slice(0, 3);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <PageHeader
        title="Моё обучение"
        description="Продолжайте курсы, следите за прогрессом и находите материалы в одном месте."
        actions={
          <Link to="/academy-grok/catalog">
            <Button variant="secondary">
              <BookOpenCheck className="size-4" />
              Каталог курсов
            </Button>
          </Link>
        }
      />
      <AcademyGrokNav canManage={canManage} />

      {/* Hero / continue learning — Thinkific Learner Hub + TalentLMS widgets */}
      {continueItem ? (
        <section
          className={`relative overflow-hidden rounded-2xl bg-gradient-to-br p-6 text-white shadow-card sm:p-8 ${courseCoverClass(continueItem.course.id)}`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.2),transparent_50%)]" />
          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-2xl">
              <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-white/85">
                <PlayCircle className="size-4" />
                {continueItem.percent > 0 ? 'Продолжить обучение' : 'Начать обучение'}
              </p>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {continueItem.course.title}
              </h2>
              {continueItem.course.description && (
                <p className="mt-2 text-sm text-white/80 sm:text-base">
                  {continueItem.course.description}
                </p>
              )}
              <div className="mt-5 max-w-md">
                <div className="mb-1.5 flex justify-between text-xs font-medium text-white/80">
                  <span>
                    {continueItem.progress?.completedLessonIds.length ?? 0} из{' '}
                    {continueItem.lessons.length}{' '}
                    {plural(continueItem.lessons.length, ['урока', 'уроков', 'уроков'])}
                  </span>
                  <span>{continueItem.percent}%</span>
                </div>
                <ProgressBar
                  value={continueItem.percent}
                  size="lg"
                  className="bg-white/25"
                  barClassName="bg-white"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to={`/learn-grok/${continueItem.course.id}`}>
                <Button
                  size="lg"
                  className="bg-white text-slate-900 hover:bg-white/90 active:bg-white"
                >
                  <PlayCircle className="size-5" />
                  {continueItem.percent > 0 ? 'Продолжить' : 'Начать курс'}
                </Button>
              </Link>
              <Link to={`/academy-grok/courses/${continueItem.course.id}`}>
                <Button
                  size="lg"
                  variant="secondary"
                  className="border-white/30 bg-white/10 text-white hover:border-white/50 hover:bg-white/20 hover:text-white"
                >
                  О курсе
                </Button>
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <EmptyState
          icon={Sparkles}
          title="Пока нет курсов для прохождения"
          description="Когда вам назначат курс или откроют каталог компании, он появится здесь. Загляните в каталог."
          action={
            <Link to="/academy-grok/catalog">
              <Button>
                Открыть каталог
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          }
        />
      )}

      {/* Stats widgets — TalentLMS Overview */}
      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={Target}
          label="Активных курсов"
          value={String(inProgressCount)}
          hint="В процессе прямо сейчас"
        />
        <StatCard
          icon={Award}
          label="Завершено"
          value={String(completedCount)}
          hint={
            myCourses.length
              ? `из ${myCourses.length} ${plural(myCourses.length, ['курса', 'курсов', 'курсов'])}`
              : 'ещё нет назначений'
          }
        />
        <StatCard
          icon={Clock3}
          label="Средний прогресс"
          value={`${avgProgress}%`}
          hint="По всем вашим курсам"
        />
      </section>

      {/* My courses grid */}
      {myCourses.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Мои курсы</h2>
              <p className="text-sm text-slate-500">Назначенные и доступные вам материалы</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {myCourses.map(({ course, progress: itemProgress }) => (
              <GrokCourseCard
                key={course.id}
                course={course}
                lessons={lessons}
                progress={itemProgress}
              />
            ))}
          </div>
        </section>
      )}

      {/* Catalog teaser */}
      {catalogPreview.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Ещё в каталоге</h2>
              <p className="text-sm text-slate-500">Курсы компании, которые вы ещё не открывали</p>
            </div>
            <Link to="/academy-grok/catalog" className="text-sm font-semibold text-primary-600">
              Весь каталог
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {catalogPreview.map((course) => (
              <GrokCourseCard
                key={course.id}
                course={course}
                lessons={lessons}
                ctaLabel="Смотреть"
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-surface p-4 shadow-card">
      <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
        <Icon className="size-5" />
      </div>
      <p className="text-2xl font-bold tracking-tight text-slate-950">{value}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-800">{label}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}
