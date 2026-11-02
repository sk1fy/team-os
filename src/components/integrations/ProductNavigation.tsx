import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/api';
import { queryKeys } from '@/api/queryKeys';
import { canAccessRoute } from '@/lib/permissions';
export function ProductNavigation() {
  const user = useQuery({ queryKey: queryKeys.currentUser, queryFn: authApi.getCurrentUser });
  if (!user.data) return null;
  const actor = user.data;
  return (
    <nav
      aria-label="Продукты amoCRM"
      className="flex flex-wrap gap-4 rounded-lg border border-slate-200 bg-surface px-4 py-3 text-sm"
    >
      {[
        { to: '/activity-control', label: 'Контроль активности' },
        { to: '/task-control', label: 'Контроль задач' },
        { to: '/distribution', label: 'Распределение сделок' },
        { to: '/settings', label: 'Настройки' },
      ]
        .filter((item) => canAccessRoute(actor.role, item.to, actor.sectionAccess))
        .map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              isActive ? 'font-semibold text-primary-700' : 'text-slate-600 hover:text-primary-600'
            }
          >
            {item.label}
          </NavLink>
        ))}
    </nav>
  );
}
