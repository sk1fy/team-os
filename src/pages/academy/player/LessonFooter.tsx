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
    <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
      <Button variant="secondary" size="sm" disabled={!canGoPrev} onClick={onPrev}>
        <ChevronLeft className="size-4" />
        Назад
      </Button>
      <div className="flex flex-wrap gap-2">
        {showComplete ? (
          <Button
            size="sm"
            disabled={completeDisabled}
            loading={completeLoading}
            onClick={onComplete}
          >
            {completeLabel}
            <ChevronRight className="size-4" />
          </Button>
        ) : canGoNext ? (
          <Button size="sm" variant="secondary" onClick={onNext}>
            Далее
            <ChevronRight className="size-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
