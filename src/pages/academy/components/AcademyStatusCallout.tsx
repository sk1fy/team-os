import { AlertTriangle, Info, Lock, ShieldOff } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { StatusTone } from '@/lib/academy/statuses';

const toneStyles: Record<StatusTone, string> = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  danger: 'border-red-200 bg-red-50 text-red-900',
  info: 'border-sky-200 bg-sky-50 text-sky-950',
};

const toneIcons = {
  neutral: Info,
  success: Info,
  warning: AlertTriangle,
  danger: ShieldOff,
  info: Lock,
} as const;

export function AcademyStatusCallout({
  title,
  description,
  tone = 'info',
  className,
  actions,
}: {
  title: string;
  description?: string;
  tone?: StatusTone;
  className?: string;
  actions?: React.ReactNode;
}) {
  const Icon = toneIcons[tone];
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-start',
        toneStyles[tone],
        className,
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0 opacity-80" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {description ? <p className="mt-1 text-sm opacity-90">{description}</p> : null}
        {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
