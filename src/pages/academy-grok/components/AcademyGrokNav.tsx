import { NavLink } from 'react-router-dom';
import { BarChart3, BookOpen, LayoutDashboard, Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';

const baseItems = [
  { to: '/academy-grok', label: 'Моё обучение', icon: LayoutDashboard, end: true },
  { to: '/academy-grok/catalog', label: 'Каталог', icon: BookOpen, end: false },
] as const;

const adminItems = [
  { to: '/academy-grok/reports', label: 'Отчёты', icon: BarChart3, end: false },
] as const;

export function AcademyGrokNav({ canManage }: { canManage: boolean }) {
  const items = canManage ? [...baseItems, ...adminItems] : [...baseItems];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700">
          <Sparkles className="size-3.5" />
          Академия Grok
        </span>
        <span className="hidden sm:inline">Альтернативный UX · сравнение с «Академией»</span>
      </div>
      <nav className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-surface text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900',
              )
            }
          >
            <Icon className="size-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
