import type { LucideIcon } from 'lucide-react';

export function WidgetCard({
  title,
  icon: Icon,
  footnote,
  children,
}: {
  title: string;
  icon: LucideIcon;
  footnote: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-slate-200 bg-surface shadow-card">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <Icon className="size-4 text-primary-500" />
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="flex-1 p-4">{children}</div>
      <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">{footnote}</p>
    </div>
  );
}