import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTitle } from '@reactuses/core';
import { ArrowRight, BookOpenCheck, Clock3, PlayCircle, Target } from 'lucide-react';
import { academyLearningApi } from '@/api/academy';
import { queryKeys } from '@/api/queryKeys';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { Button } from '@/components/ui';
import { academyRoutes, enrollmentProgressLabel } from '@/lib/academy';
import { StatusBadgeFromPresentation } from './components/StatusBadge';
import type { EnrollmentSummary } from '@/types/academy';

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Target;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
        </div>
        <div className="rounded-lg bg-primary-50 p-2 text-primary-600">
          <Icon className="size-5" />
        </div>
      </div>
    </div>
  );
}

function EnrollmentCard({ item }: { item: EnrollmentSummary }) {
  const progress = enrollmentProgressLabel(item.progressStatus);
  return (
    <Link
      to={academyRoutes.learn(item.id)}
      className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-surface p-4 shadow-sm transition hover:border-primary-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-900 group-hover:text-primary-700">
            {item.courseTitle}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {item.completedLessons} из {item.totalLessons} уроков
          </p>
        </div>
        <StatusBadgeFromPresentation status={progress} />
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-primary-500 transition-all"
          style={{ width: `${Math.min(100, Math.max(0, item.percent))}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{item.percent}%</span>
        <span className="inline-flex items-center gap-1 font-medium text-primary-600">
          Открыть
          <ArrowRight className="size-4" />
        </span>
      </div>
    </Link>
  );
}

export function AcademyHomePage() {
  useTitle('Моё обучение — Академия — TeamOS');

  const learningQuery = useQuery({
    queryKey: queryKeys.academyV2.myLearning,
    queryFn: ({ signal }) => academyLearningApi.myLearning({ signal }),
  });

  if (learningQuery.isError) {
    return (
      <ErrorState
        title="Не удалось загрузить обучение"
        description="Проверьте соединение и попробуйте снова."
        onRetry={() => void learningQuery.refetch()}
      />
    );
  }

  const data = learningQuery.data;
  const continueItem = data?.continueEnrollment;
  const enrollments = data?.enrollments ?? [];
  const stats = data?.stats;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Моё обучение"
        description="Назначенные курсы, прогресс и продолжение с того места, где остановились."
        actions={
          <Link to={academyRoutes.catalog}>
            <Button variant="secondary">Каталог курсов</Button>
          </Link>
        }
      />

      {learningQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : (
        <>
          {continueItem ? (
            <section className="rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50 to-surface p-5 shadow-sm sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">
                Продолжить
              </p>
              <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold text-slate-950">{continueItem.courseTitle}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Прогресс {continueItem.percent}% · {continueItem.completedLessons}/
                    {continueItem.totalLessons} уроков
                  </p>
                </div>
                <Link to={academyRoutes.learn(continueItem.id)}>
                  <Button>
                    <PlayCircle className="size-4" />
                    Продолжить обучение
                  </Button>
                </Link>
              </div>
            </section>
          ) : null}

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="В процессе" value={stats?.inProgress ?? 0} icon={Clock3} />
            <StatCard label="Завершено" value={stats?.completed ?? 0} icon={BookOpenCheck} />
            <StatCard label="Просрочено" value={stats?.overdue ?? 0} icon={Target} />
            <StatCard label="Всего назначено" value={stats?.totalAssigned ?? 0} icon={Target} />
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Мои курсы</h2>
            {enrollments.length === 0 ? (
              <EmptyState
                icon={BookOpenCheck}
                title="Пока нет назначенных курсов"
                description="Когда вам назначат обучение, оно появится здесь. Можно посмотреть каталог компании."
                action={
                  <Link to={academyRoutes.catalog}>
                    <Button>Открыть каталог</Button>
                  </Link>
                }
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {enrollments.map((item) => (
                  <EnrollmentCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
