import { CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui';

export function LessonFooter({
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  showComplete,
  completeLabel,
  completeDisabled,
  completeLoading,
  onComplete,
  nextLessonTitle,
  lessonCompleted,
}: {
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  showComplete: boolean;
  completeLabel: string;
  completeDisabled?: boolean;
  completeLoading?: boolean;
  onComplete: () => void;
  nextLessonTitle?: string;
  lessonCompleted?: boolean;
}) {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <Button
        variant="secondary"
        size="sm"
        className="w-full sm:w-auto"
        disabled={!canGoPrev}
        onClick={onPrev}
      >
        <ChevronLeft className="size-4" />
        Назад
      </Button>
      <div className="order-first min-w-0 flex-1 sm:order-none">
        {lessonCompleted ? (
          <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-700 sm:justify-end">
            <CheckCircle2 className="size-4" aria-hidden />
            Урок завершён
          </p>
        ) : showComplete ? (
          <p className="text-center text-xs text-slate-500 sm:text-right">
            Материал изучен? Отметьте урок завершённым
          </p>
        ) : null}
        {nextLessonTitle && (lessonCompleted || canGoNext) ? (
          <p className="mt-0.5 truncate text-center text-xs text-slate-500 sm:text-right">
            Далее: {nextLessonTitle}
          </p>
        ) : null}
      </div>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        {showComplete ? (
          <Button
            size="md"
            className="w-full sm:w-auto"
            disabled={completeDisabled}
            loading={completeLoading}
            onClick={onComplete}
          >
            {completeLabel}
            <ChevronRight className="size-4" />
          </Button>
        ) : canGoNext ? (
          <Button className="w-full sm:w-auto" size="md" onClick={onNext}>
            Следующий урок
            <ChevronRight className="size-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
