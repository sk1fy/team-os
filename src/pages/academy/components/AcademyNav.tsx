import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  BookOpen,
  Building2,
  FileStack,
  LayoutDashboard,
  Library,
  Users,
} from 'lucide-react';
import { authApi } from '@/api';
import { queryKeys } from '@/api/queryKeys';
import { academyNavForRole, type AcademyNavItemId } from '@/lib/academy';
import { cn } from '@/lib/cn';
import { prefetchRoute } from '@/lib/routePrefetch';

const icons: Record<AcademyNavItemId, typeof LayoutDashboard> = {
  home: LayoutDashboard,
  catalog: BookOpen,
  courses: Library,
  partners: Building2,
  templates: FileStack,
  reports: BarChart3,
  learners: Users,
};

export function AcademyNav() {
  const { data: currentUser } = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: authApi.getCurrentUser,
  });

  const items = academyNavForRole(currentUser?.role);

  if (items.length === 0) return null;

  return (
    <nav
      className="flex flex-nowrap gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-1"
      aria-label="Разделы Академии"
    >
      {items.map(({ id, to, label, end }) => {
        const Icon = icons[id];
        return (
          <NavLink
            key={id}
            to={to}
            end={end}
            onMouseEnter={() => prefetchRoute(to)}
            onFocus={() => prefetchRoute(to)}
            className={({ isActive }) =>
              cn(
                'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-surface text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900',
              )
            }
          >
            <Icon className="size-4" />
            {label}
          </NavLink>
        );
      })}
    </nav>
  );
}
