import { cn } from '@/lib/cn';

export function ProgressBar({
  value,
  className,
  barClassName,
  size = 'md',
}: {
  value: number;
  className?: string;
  barClassName?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn(
        'overflow-hidden rounded-full bg-slate-100',
        size === 'sm' && 'h-1.5',
        size === 'md' && 'h-2',
        size === 'lg' && 'h-2.5',
        className,
      )}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          'h-full rounded-full bg-primary-500 transition-[width] duration-300',
          clamped >= 100 && 'bg-success-500',
          barClassName,
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
