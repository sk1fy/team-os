/** Мелкие представления, общие для вкладок Академии Opus. */

import type { CourseProgressStatus } from '@/types';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { daysUntilDue } from '@/lib/courseProgress';
import { plural } from '@/lib/format';
import { statusLabels, statusVariants } from './labels';

export function StatusBadge({ status }: { status: CourseProgressStatus }) {
  return <Badge variant={statusVariants[status]}>{statusLabels[status]}</Badge>;
}

/**
 * Дедлайн словами. Просрочка и «горит сегодня-завтра» подсвечиваются —
 * именно этого не хватало базовой Академии, где deadlineDays нигде не виден.
 */
export function DueDateLabel({ dueDate, now = new Date() }: { dueDate?: string; now?: Date }) {
  if (!dueDate) return <span className="text-slate-400">—</span>;

  const days = daysUntilDue(dueDate, now);
  if (days < 0) {
    const overdue = Math.abs(days);
    return (
      <span className="font-medium text-danger-600">
        просрочен на {overdue} {plural(overdue, ['день', 'дня', 'дней'])}
      </span>
    );
  }
  if (days === 0) return <span className="font-medium text-warning-700">сегодня</span>;
  if (days === 1) return <span className="font-medium text-warning-700">завтра</span>;
  return (
    <span className="text-slate-600">
      через {days} {plural(days, ['день', 'дня', 'дней'])}
    </span>
  );
}

export function ProgressBar({ percent, className }: { percent: number; className?: string }) {
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-slate-100', className)}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width]',
          percent === 100 ? 'bg-success-500' : 'bg-primary-500',
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
