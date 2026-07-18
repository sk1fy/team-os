import { GraduationCap } from 'lucide-react';
import type { Course, CourseProgress, CourseProgressStatus } from '@/types';
import { Badge } from '@/components/ui';
import { WidgetCard } from './WidgetCard';

const progressStatusLabels: Record<CourseProgressStatus, string> = {
  not_started: 'Не начат',
  in_progress: 'В процессе',
  completed: 'Завершён',
  overdue: 'Просрочен',
};

const progressStatusVariants: Record<
  CourseProgressStatus,
  'neutral' | 'primary' | 'success' | 'danger'
> = {
  not_started: 'neutral',
  in_progress: 'primary',
  completed: 'success',
  overdue: 'danger',
};

interface EmployeeLearningWidgetProps {
  progress: CourseProgress[];
  notStartedCourseIds: string[];
  courses: Course[];
  footnote?: string;
}

export function EmployeeLearningWidget({
  progress,
  notStartedCourseIds,
  courses,
  footnote = 'Прогресс в академии',
}: EmployeeLearningWidgetProps) {
  const courseTitle = (courseId: string) =>
    courses.find((course) => course.id === courseId)?.title ?? 'Курс';

  return (
    <WidgetCard title="Обучение" icon={GraduationCap} footnote={footnote}>
      {progress.length === 0 && notStartedCourseIds.length === 0 ? (
        <p className="text-sm text-slate-400">Курсы пока не назначены.</p>
      ) : (
        <div className="space-y-2">
          {progress.map((entry) => (
            <div
              key={entry.courseId}
              className="flex items-center justify-between gap-3 rounded-md border border-slate-100 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-800">{courseTitle(entry.courseId)}</p>
                <p className="text-xs text-slate-400">
                  Пройдено уроков: {entry.completedLessonIds.length}
                </p>
              </div>
              <Badge variant={progressStatusVariants[entry.status]}>
                {progressStatusLabels[entry.status]}
              </Badge>
            </div>
          ))}
          {notStartedCourseIds.map((courseId) => (
            <div
              key={courseId}
              className="flex items-center justify-between gap-3 rounded-md border border-slate-100 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-800">{courseTitle(courseId)}</p>
                <p className="text-xs text-slate-400">Обязательный для должности</p>
              </div>
              <Badge variant={progressStatusVariants.not_started}>
                {progressStatusLabels.not_started}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
