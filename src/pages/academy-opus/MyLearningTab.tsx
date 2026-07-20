/**
 * «Моё обучение» — то, что назначено именно текущему пользователю.
 *
 * Базовая Академия показывает в этом блоке все назначения компании без
 * фильтра по человеку, из-за чего в списке появляются чужие строки и дубли.
 * Здесь список приходит уже развёрнутым и отфильтрованным из API.
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap, PlayCircle } from 'lucide-react';
import { academyOpusApi } from '@/api/academyOpus';
import { queryKeys } from '@/api/queryKeys';
import type { Course, CourseProgress, Lesson, User } from '@/types';
import { Button } from '@/components/ui';
import { EmptyState } from '@/components/layout/EmptyState';
import { progressPercent, resolveStatus } from '@/lib/courseProgress';
import { DueDateLabel, ProgressBar, StatusBadge } from './shared';

export function MyLearningTab({
  courses,
  lessons,
  progress,
  currentUser,
}: {
  courses: Course[];
  lessons: Lesson[];
  progress: CourseProgress[];
  currentUser: User | undefined;
}) {
  const navigate = useNavigate();

  const assignmentsQuery = useQuery({
    queryKey: queryKeys.academyOpus.myAssignments,
    queryFn: academyOpusApi.getMyAssignments,
    enabled: Boolean(currentUser),
  });
  const now = useMemo(() => new Date(), []);

  const items = useMemo(() => {
    const courseById = new Map(courses.map((course) => [course.id, course]));
    const lessonCount = new Map<string, number>();
    for (const lesson of lessons) {
      lessonCount.set(lesson.courseId, (lessonCount.get(lesson.courseId) ?? 0) + 1);
    }

    return (assignmentsQuery.data ?? [])
      .map((assignment) => {
        const course = courseById.get(assignment.courseId);
        if (!course) return null;

        const item = progress.find(
          (entry) => entry.courseId === course.id && entry.userId === currentUser?.id,
        );
        const total = lessonCount.get(course.id) ?? 0;

        return {
          assignment,
          course,
          percent: progressPercent(total, item?.completedLessonIds.length ?? 0),
          status: resolveStatus(item, assignment.dueDate, now),
          total,
          completed: item?.completedLessonIds.length ?? 0,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => {
        // Сначала горящее: просроченное, затем по дедлайну, затем без дедлайна.
        const weight = (status: string) =>
          status === 'overdue' ? 0 : status === 'completed' ? 2 : 1;
        const diff = weight(a.status) - weight(b.status);
        if (diff !== 0) return diff;
        if (a.assignment.dueDate && b.assignment.dueDate) {
          return a.assignment.dueDate.localeCompare(b.assignment.dueDate);
        }
        return a.assignment.dueDate ? -1 : b.assignment.dueDate ? 1 : 0;
      });
  }, [assignmentsQuery.data, courses, currentUser?.id, lessons, now, progress]);

  if (assignmentsQuery.isPending) {
    return <div className="h-48 animate-pulse rounded-lg bg-slate-200/60" />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="Вам пока не назначено ни одного курса"
        description="Загляните в каталог — часть курсов открыта всей компании."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <article
            key={`${item.assignment.courseId}-${item.assignment.assignmentId}`}
            className="flex flex-col rounded-lg border border-slate-200 bg-surface p-4 shadow-card"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <StatusBadge status={item.status} />
            </div>

            <h3 className="text-base font-semibold text-slate-950">{item.course.title}</h3>
            {item.course.description && (
              <p className="mt-1 line-clamp-2 text-sm text-slate-500">{item.course.description}</p>
            )}

            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Уроков</dt>
                <dd className="text-slate-700">
                  {item.completed} из {item.total}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Дедлайн</dt>
                <dd>
                  <DueDateLabel dueDate={item.assignment.dueDate} now={now} />
                </dd>
              </div>
            </dl>

            <div className="mt-3">
              <ProgressBar percent={item.percent} />
              <p className="mt-1 text-xs text-slate-500">{item.percent}% пройдено</p>
            </div>

            <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
              <Button size="sm" onClick={() => navigate(`/learn-opus/${item.course.id}`)}>
                <PlayCircle className="size-4" />
                {item.percent === 0 ? 'Начать' : item.percent === 100 ? 'Повторить' : 'Продолжить'}
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
