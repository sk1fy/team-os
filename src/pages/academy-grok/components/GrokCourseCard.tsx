import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CheckCircle2, Clock3, Layers } from 'lucide-react';
import type { Course, CourseProgress, Lesson } from '@/types';
import { Badge, Button } from '@/components/ui';
import { plural } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  courseCoverClass,
  progressPercent,
  progressStatusLabels,
  progressStatusVariants,
  statusLabels,
  visibilityLabels,
} from '../utils';
import { ProgressBar } from './ProgressBar';

export function GrokCourseCard({
  course,
  lessons,
  progress,
  compact = false,
  showAdminBadges = false,
  ctaLabel,
}: {
  course: Course;
  lessons: Lesson[];
  progress?: CourseProgress;
  compact?: boolean;
  showAdminBadges?: boolean;
  ctaLabel?: string;
}) {
  const courseLessons = lessons.filter((lesson) => lesson.courseId === course.id);
  const percent = progressPercent(courseLessons, progress);
  const status = progress?.status ?? 'not_started';
  const isComplete = status === 'completed' || percent >= 100;
  const fromKb = courseLessons.some((lesson) => lesson.sourceArticleId);

  return (
    <article
      className={cn(
        'group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-surface shadow-card transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md',
        compact && 'sm:flex-row',
      )}
    >
      <div
        className={cn(
          'relative bg-gradient-to-br p-4 text-white',
          courseCoverClass(course.id),
          compact ? 'sm:w-40 sm:shrink-0' : 'min-h-28',
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_55%)]" />
        <div className="relative flex h-full flex-col justify-between gap-3">
          <div className="flex flex-wrap gap-1">
            {showAdminBadges && (
              <Badge
                variant={course.status === 'published' ? 'success' : 'warning'}
                className="bg-white/90"
              >
                {statusLabels[course.status]}
              </Badge>
            )}
            {fromKb && (
              <span className="inline-flex items-center gap-1 rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm">
                <BookOpen className="size-3" />
                База знаний
              </span>
            )}
          </div>
          <div className="text-xs font-medium text-white/80">
            {courseLessons.length}{' '}
            {plural(courseLessons.length, ['урок', 'урока', 'уроков'])}
            {course.sequential ? ' · по шагам' : ' · свободно'}
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            {progress ? (
              <Badge variant={progressStatusVariants[status]}>
                {progressStatusLabels[status]}
              </Badge>
            ) : (
              <Badge variant="neutral">{visibilityLabels[course.visibility]}</Badge>
            )}
            {course.deadlineDays ? (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Clock3 className="size-3" />
                {course.deadlineDays} дн. на прохождение
              </span>
            ) : null}
          </div>
          <h3 className="line-clamp-2 text-base font-semibold text-slate-950 group-hover:text-primary-700">
            {course.title}
          </h3>
          {course.description && (
            <p className="mt-1 line-clamp-2 text-sm text-slate-500">{course.description}</p>
          )}
        </div>

        {(progress || percent > 0) && (
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
              <span>Прогресс</span>
              <span className="font-semibold text-slate-700">{percent}%</span>
            </div>
            <ProgressBar value={percent} />
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
            <Layers className="size-3.5" />
            {course.visibility === 'restricted' ? 'Назначенный' : visibilityLabels[course.visibility]}
          </span>
          <Link to={`/academy-grok/courses/${course.id}`}>
            <Button size="sm" variant={isComplete ? 'secondary' : 'primary'}>
              {isComplete ? (
                <>
                  <CheckCircle2 className="size-4" />
                  Повторить
                </>
              ) : (
                <>
                  {ctaLabel ?? (percent > 0 ? 'Продолжить' : 'Открыть')}
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </Link>
        </div>
      </div>
    </article>
  );
}
