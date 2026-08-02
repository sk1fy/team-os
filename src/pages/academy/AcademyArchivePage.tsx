import { useQuery } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { Archive, Clock3 } from 'lucide-react';
import { academyLearningApi } from '@/api/academy';
import { queryKeys } from '@/api/queryKeys';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  enrollmentAccessLabel,
  enrollmentProgressLabel,
  isEnrollmentArchived,
  sortEnrollmentsForMyLearning,
} from '@/lib/academy';
import type { EnrollmentSummary } from '@/types/academy';
import { StatusBadgeFromPresentation } from './components/StatusBadge';

function ArchivedEnrollmentCard({ item }: { item: EnrollmentSummary }) {
  const deadline = item.dueDate ?? item.accessUntil;
  const deadlineDate = deadline ? new Date(deadline) : null;

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-slate-900">{item.courseTitle}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {item.completedLessons} из {item.totalLessons} уроков · {item.percent}%
          </p>
          {deadlineDate && Number.isFinite(deadlineDate.getTime()) ? (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
              <Clock3 className="size-3.5" />
              Доступ был до {deadlineDate.toLocaleDateString('ru-RU')}
            </p>
          ) : null}
        </div>
        <StatusBadgeFromPresentation status={enrollmentAccessLabel(item.accessStatus)} />
      </div>
      <div className="flex items-center justify-between text-sm text-slate-500">
        <StatusBadgeFromPresentation status={enrollmentProgressLabel(item.progressStatus)} />
        <span>Материалы недоступны</span>
      </div>
    </article>
  );
}

export function AcademyArchivePage() {
  useTitle('Архив обучения — Академия — TeamOS');

  const learningQuery = useQuery({
    queryKey: queryKeys.academyV2.myLearning,
    queryFn: ({ signal }) => academyLearningApi.myLearning({ signal }),
  });

  if (learningQuery.isError) {
    return (
      <ErrorState
        title="Не удалось загрузить архив"
        description="Проверьте соединение и попробуйте снова."
        onRetry={() => void learningQuery.refetch()}
      />
    );
  }

  const archived = sortEnrollmentsForMyLearning(
    (learningQuery.data?.enrollments ?? []).filter(isEnrollmentArchived),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Архив обучения"
        description="Курсы, которые удалены, заархивированы, скрыты или больше недоступны."
      />

      {learningQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : archived.length === 0 ? (
        <EmptyState
          icon={Archive}
          title="Архив пуст"
          description="Здесь появятся курсы, доступ к которым был закрыт."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {archived.map((item) => (
            <ArchivedEnrollmentCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
