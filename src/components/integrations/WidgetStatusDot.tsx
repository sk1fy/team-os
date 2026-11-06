import { cn } from '@/lib/cn';
import type { WidgetLevel } from './widgetStatus';

const dotClasses: Record<WidgetLevel, string> = {
  ok: 'bg-success-600',
  warn: 'bg-warning-500',
  setup: 'bg-sky-600',
  off: 'border-[1.5px] border-slate-400 bg-transparent',
};

/** Точка статуса виджета: зелёная — работает, жёлтая — проблема, синяя — не настроен, пустая — не подключён. */
export function WidgetStatusDot({ level, className }: { level: WidgetLevel; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block size-2 shrink-0 rounded-full', dotClasses[level], className)}
    />
  );
}
