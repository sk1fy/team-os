import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import {
  Award,
  BarChart3,
  CheckCircle2,
  Clock3,
  Download,
  TrendingUp,
  UsersRound,
} from 'lucide-react';
import { httpAcademyApi, httpAuthApi, httpOrgApi } from '@/api/http';
import { queryKeys } from '@/api/queryKeys';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { Avatar, Badge, Button } from '@/components/ui';
import { canManageContent } from '@/lib/permissions';
import { fullName } from '@/lib/labels';
import { toast } from '@/stores/toast';
import { AcademyGrokNav } from './components/AcademyGrokNav';
import { ProgressBar } from './components/ProgressBar';
import { progressPercent, progressStatusLabels, progressStatusVariants } from './utils';
import type { Course, CourseProgress, Lesson, User } from '@/types';

const emptyCourses: Course[] = [];
const emptyLessons: Lesson[] = [];
const emptyProgress: CourseProgress[] = [];
const emptyUsers: User[] = [];

export function AcademyGrokReportsPage() {
  useTitle('Отчёты — Академия Grok — TeamOS');

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
  const usersQuery = useQuery({
    queryKey: queryKeys.academyGrok.users,
    queryFn: httpOrgApi.getUsers,
  });

  const canManage = canManageContent(currentUserQuery.data?.role);
  const courses = coursesQuery.data ?? emptyCourses;
  const lessons = lessonsQuery.data ?? emptyLessons;
  const progress = progressQuery.data ?? emptyProgress;
  const users = usersQuery.data ?? emptyUsers;

  const stats = useMemo(() => {
    const completed = progress.filter((item) => item.status === 'completed').length;
    const inProgress = progress.filter((item) => item.status === 'in_progress').length;
    const overdue = progress.filter((item) => item.status === 'overdue').length;
    const avg =
      progress.length === 0
        ? 0
        : Math.round(
            progress.reduce(
              (sum, item) =>
                sum +
                progressPercent(
                  lessons.filter((lesson) => lesson.courseId === item.courseId),
                  item,
                ),
              0,
            ) / progress.length,
          );
    return { completed, inProgress, overdue, avg, total: progress.length };
  }, [lessons, progress]);

  const byCourse = useMemo(() => {
    return courses
      .map((course) => {
        const rows = progress.filter((item) => item.courseId === course.id);
        const courseLessons = lessons.filter((lesson) => lesson.courseId === course.id);
        const avg =
          rows.length === 0
            ? 0
            : Math.round(
                rows.reduce((sum, item) => sum + progressPercent(courseLessons, item), 0) /
                  rows.length,
              );
        return {
          course,
          learners: rows.length,
          completed: rows.filter((item) => item.status === 'completed').length,
          avg,
        };
      })
      .filter((item) => item.learners > 0)
      .sort((a, b) => b.learners - a.learners);
  }, [courses, lessons, progress]);

  const exportCsv = () => {
    const rows = [
      ['Сотрудник', 'Курс', 'Статус', 'Прогресс %'],
      ...progress.map((item) => {
        const user = users.find((candidate) => candidate.id === item.userId);
        const course = courses.find((candidate) => candidate.id === item.courseId);
        const courseLessons = lessons.filter((lesson) => lesson.courseId === item.courseId);
        return [
          user ? fullName(user) : item.userId,
          course?.title ?? item.courseId,
          progressStatusLabels[item.status],
          String(progressPercent(courseLessons, item)),
        ];
      }),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    void navigator.clipboard.writeText(csv);
    toast.success('CSV скопирован в буфер обмена');
  };

  if (!canManage) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <EmptyState
          icon={BarChart3}
          title="Отчёты только для администраторов"
          description="Сотрудники видят свой прогресс в разделе «Моё обучение»."
          action={
            <Link to="/academy-grok">
              <Button>К моему обучению</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <PageHeader
        title="Отчёты по обучению"
        description="Сводка по команде: кто учится, где отстают, что завершено."
        actions={
          <Button
            variant="secondary"
            size="sm"
            disabled={progress.length === 0}
            onClick={exportCsv}
          >
            <Download className="size-4" />
            CSV
          </Button>
        }
      />
      <AcademyGrokNav canManage={canManage} />

      {/* KPI widgets — TalentLMS admin dashboard */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={UsersRound}
          label="Записей прогресса"
          value={String(stats.total)}
          tone="primary"
        />
        <Kpi icon={TrendingUp} label="В процессе" value={String(stats.inProgress)} tone="warning" />
        <Kpi icon={CheckCircle2} label="Завершено" value={String(stats.completed)} tone="success" />
        <Kpi icon={Clock3} label="Средний прогресс" value={`${stats.avg}%`} tone="neutral" />
      </section>

      {stats.overdue > 0 && (
        <div className="rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          Просроченных назначений: <strong>{stats.overdue}</strong>
        </div>
      )}

      {/* Course breakdown */}
      {byCourse.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-surface p-5 shadow-card">
          <h2 className="mb-4 text-base font-semibold text-slate-950">По курсам</h2>
          <div className="space-y-4">
            {byCourse.map(({ course, learners, completed, avg }) => (
              <div key={course.id}>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <Link
                    to={`/academy-grok/courses/${course.id}`}
                    className="text-sm font-semibold text-slate-900 hover:text-primary-700"
                  >
                    {course.title}
                  </Link>
                  <span className="text-xs text-slate-500">
                    {completed}/{learners} завершили · ср. {avg}%
                  </span>
                </div>
                <ProgressBar value={avg} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Detail table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-surface shadow-card">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <BarChart3 className="size-5 text-slate-400" />
          <h2 className="text-base font-semibold text-slate-950">Детализация</h2>
        </div>
        {progress.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Award}
              title="Данных о прогрессе пока нет"
              description="Назначьте курсы сотрудникам — результаты появятся здесь."
              action={
                <Link to="/academy-grok/catalog">
                  <Button variant="secondary">Открыть каталог</Button>
                </Link>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-slate-100 text-xs tracking-wide text-slate-400 uppercase">
                  <th className="px-5 py-3 font-semibold">Сотрудник</th>
                  <th className="px-5 py-3 font-semibold">Курс</th>
                  <th className="px-5 py-3 font-semibold">Статус</th>
                  <th className="px-5 py-3 font-semibold">Прогресс</th>
                  <th className="px-5 py-3 font-semibold">Проверка</th>
                </tr>
              </thead>
              <tbody>
                {progress.map((item) => {
                  const user = users.find((candidate) => candidate.id === item.userId);
                  const course = courses.find((candidate) => candidate.id === item.courseId);
                  const courseLessons = lessons.filter(
                    (lesson) => lesson.courseId === item.courseId,
                  );
                  const percent = progressPercent(courseLessons, item);
                  const pendingReview = item.quizAttempts.some((attempt) => attempt.pendingReview);
                  return (
                    <tr
                      key={`${item.userId}-${item.courseId}`}
                      className="border-b border-slate-50 last:border-0"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {user && <Avatar name={fullName(user)} src={user.avatarUrl} size="sm" />}
                          <span className="text-sm font-medium text-slate-900">
                            {user ? fullName(user) : item.userId}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-600">
                        {course ? (
                          <Link
                            to={`/academy-grok/courses/${course.id}`}
                            className="hover:text-primary-700"
                          >
                            {course.title}
                          </Link>
                        ) : (
                          item.courseId
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={progressStatusVariants[item.status]}>
                          {progressStatusLabels[item.status]}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <ProgressBar value={percent} className="w-24" size="sm" />
                          <span className="text-xs font-medium text-slate-600">{percent}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={pendingReview ? 'warning' : 'neutral'}>
                          {pendingReview ? 'Нужна' : 'Нет'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof UsersRound;
  label: string;
  value: string;
  tone: 'primary' | 'success' | 'warning' | 'neutral';
}) {
  const tones = {
    primary: 'bg-primary-50 text-primary-600',
    success: 'bg-success-50 text-success-600',
    warning: 'bg-warning-50 text-warning-700',
    neutral: 'bg-slate-100 text-slate-600',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-surface p-4 shadow-card">
      <div className={`mb-3 flex size-9 items-center justify-center rounded-lg ${tones[tone]}`}>
        <Icon className="size-5" />
      </div>
      <p className="text-2xl font-bold tracking-tight text-slate-950">{value}</p>
      <p className="mt-0.5 text-sm text-slate-500">{label}</p>
    </div>
  );
}
