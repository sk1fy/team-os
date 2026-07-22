import { ChevronLeft, ChevronRight } from 'lucide-react';
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
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
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
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
        {showComplete ? (
          <Button
            size="sm"
            className="w-full sm:w-auto"
            disabled={completeDisabled}
            loading={completeLoading}
            onClick={onComplete}
          >
            {completeLabel}
            <ChevronRight className="size-4" />
          </Button>
        ) : canGoNext ? (
          <Button className="w-full sm:w-auto" size="sm" variant="secondary" onClick={onNext}>
            Далее
            <ChevronRight className="size-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
