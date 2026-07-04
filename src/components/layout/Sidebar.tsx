import { NavLink } from 'react-router-dom';
import {
  GraduationCap,
  Home,
  KanbanSquare,
  Library,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { useUiStore } from '@/stores/ui';
import { Tooltip } from '@/components/ui';
import { cn } from '@/lib/cn';

const navItems = [
  { to: '/', label: 'Главная', icon: Home, end: true },
  { to: '/structure', label: 'Оргструктура', icon: Network },
  { to: '/employees', label: 'Сотрудники', icon: Users },
  { to: '/knowledge', label: 'База знаний', icon: Library },
  { to: '/tasks', label: 'Задачи', icon: KanbanSquare },
  { to: '/academy', label: 'Академия', icon: GraduationCap },
];

function NavItem({
  to,
  label,
  icon: Icon,
  end,
  collapsed,
}: (typeof navItems)[number] & { collapsed: boolean }) {
  const setMobileSidebarOpen = useUiStore((s) => s.setMobileSidebarOpen);

  const link = (
    <NavLink
      to={to}
      end={end}
      onClick={() => setMobileSidebarOpen(false)}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          collapsed && 'justify-center px-2',
          isActive
            ? 'bg-primary-50 text-primary-700'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        )
      }
    >
      <Icon className="size-5 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );

  return collapsed ? (
    <Tooltip content={label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}

function SidebarContent({ collapsed }: { collapsed: boolean }) {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-14 items-center px-4', collapsed && 'justify-center px-2')}>
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-sm font-bold text-white">
            T
          </div>
          {!collapsed && <span className="text-base font-bold text-slate-900">TeamOS</span>}
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {navItems.map((item) => (
          <NavItem key={item.to} {...item} collapsed={collapsed} />
        ))}
      </nav>

      <div className="space-y-1 border-t border-slate-200 p-2">
        <NavItem to="/settings" label="Настройки" icon={Settings} collapsed={collapsed} end={false} />
        <button
          onClick={toggleSidebar}
          className={cn(
            'hidden w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 lg:flex',
            collapsed && 'justify-center px-2',
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-5" />
          ) : (
            <>
              <PanelLeftClose className="size-5" />
              <span>Свернуть</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const mobileOpen = useUiStore((s) => s.mobileSidebarOpen);
  const setMobileSidebarOpen = useUiStore((s) => s.setMobileSidebarOpen);

  return (
    <>
      {/* Десктоп */}
      <aside
        className={cn(
          'hidden shrink-0 border-r border-slate-200 bg-surface transition-[width] duration-200 lg:block',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <SidebarContent collapsed={collapsed} />
      </aside>

      {/* Мобильный оверлей */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="animate-overlay-in absolute inset-0 bg-slate-950/40"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-surface shadow-popover">
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="absolute top-4 right-3 rounded-md p-1 text-slate-400 hover:bg-slate-100"
              aria-label="Закрыть меню"
            >
              <X className="size-5" />
            </button>
            <SidebarContent collapsed={false} />
          </aside>
        </div>
      )}
    </>
  );
}
