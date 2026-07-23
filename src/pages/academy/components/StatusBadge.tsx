import { cn } from '@/lib/cn';
import {
  statusToneClasses,
  type StatusPresentation,
  type StatusTone,
} from '@/lib/academy/statuses';

export function StatusBadge({
  label,
  tone,
  className,
}: {
  label: string;
  tone: StatusTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        statusToneClasses(tone),
        className,
      )}
    >
      {label}
    </span>
  );
}

export function StatusBadgeFromPresentation({
  status,
  className,
}: {
  status: StatusPresentation;
  className?: string;
}) {
  return <StatusBadge label={status.label} tone={status.tone} className={className} />;
}
