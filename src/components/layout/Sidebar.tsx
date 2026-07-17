import { NavLink, useLocation } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import {
  CalendarDays,
  GraduationCap,
  Home,
  KanbanSquare,
  Library,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Shuffle,
  Users,
  X,
} from 'lucide-react';
import { useUiStore } from '@/stores/ui';
import { Tooltip } from '@/components/ui';
import { BrandMark } from './BrandMark';
import { cn } from '@/lib/cn';
import { useLogout } from '@/components/auth/useLogout';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/api';
import { canAccessRoute } from '@/lib/permissions';

const navItems = [
  { to: '/', label: 'Главная', icon: Home, end: true },
  { to: '/employees', label: 'Сотрудники', icon: Users },
  { to: '/schedule', label: 'График', icon: CalendarDays },
  { to: '/tasks', label: 'Задачи', icon: KanbanSquare },
  { to: '/distribution', label: 'Распределение', icon: Shuffle },
  { to: '/knowledge', label: 'База знаний', icon: Library },
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
  // Активность считаем вручную: функция-className у NavLink ломается внутри
  // Radix Tooltip (Slot приводит её к строке), поэтому передаём готовую строку.
  const { pathname } = useLocation();
  const isActive = end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);

  const link = (
    <NavLink
      to={to}
      end={end}
      onClick={() => setMobileSidebarOpen(false)}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        collapsed && 'justify-center px-2',
        isActive
          ? 'bg-primary-50 font-semibold text-primary-600'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
      )}
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

function SidebarContent({
  collapsed,
  canToggle = true,
}: {
  collapsed: boolean;
  canToggle?: boolean;
}) {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const setMobileSidebarOpen = useUiStore((s) => s.setMobileSidebarOpen);
  const logout = useLogout();
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: authApi.getCurrentUser,
  });
  const visibleNavItems = navItems.filter((item) => canAccessRoute(currentUser?.role, item.to));

  const logoutButton = (
    <button
      onClick={() => {
        setMobileSidebarOpen(false);
        void logout();
      }}
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-danger-600 transition-colors hover:bg-danger-50',
        collapsed && 'justify-center px-2',
      )}
      aria-label="Выйти"
    >
      <LogOut className="size-5 shrink-0" />
      {!collapsed && <span>Выйти</span>}
    </button>
  );

  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-16 items-center px-4', collapsed && 'justify-center px-2')}>
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="group relative size-9 shrink-0 rounded-[10px]">
            <BrandMark className="size-9 rounded-[10px] transition-opacity group-hover:opacity-0" />
            {canToggle && (
              <button
                type="button"
                onClick={toggleSidebar}
                className="absolute inset-0 hidden size-9 items-center justify-center rounded-[10px] bg-ink text-white opacity-0 shadow-card transition-opacity group-hover:flex group-hover:opacity-100 focus-visible:flex focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 lg:flex"
                aria-label={collapsed ? 'Развернуть сайдбар' : 'Свернуть сайдбар'}
              >
                {collapsed ? (
                  <PanelLeftOpen className="size-5" />
                ) : (
                  <PanelLeftClose className="size-5" />
                )}
              </button>
            )}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-[17px] leading-tight font-bold tracking-[-0.2px] text-ink">
                Team<span className="text-primary-600">OS</span>
              </div>
              <div className="truncate text-xs text-slate-500">Управление командой</div>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {visibleNavItems.map((item) => (
          <NavItem key={item.to} {...item} collapsed={collapsed} />
        ))}
      </nav>

      <div className="space-y-1 border-t border-slate-200 p-2">
        <NavItem
          to="/settings"
          label="Настройки"
          icon={Settings}
          collapsed={collapsed}
          end={false}
        />
        {collapsed ? (
          <Tooltip content="Выйти" side="right">
            {logoutButton}
          </Tooltip>
        ) : (
          logoutButton
        )}
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
      <Dialog.Root open={mobileOpen} onOpenChange={setMobileSidebarOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="animate-overlay-in fixed inset-0 z-40 bg-slate-950/40 lg:hidden" />
          <Dialog.Content
            onCloseAutoFocus={(event) => {
              const trigger = document.getElementById('mobile-sidebar-trigger');
              if (!trigger) return;
              event.preventDefault();
              trigger.focus();
            }}
            className="fixed inset-y-0 left-0 z-50 w-64 bg-surface shadow-popover outline-none lg:hidden"
          >
            <Dialog.Title className="sr-only">Навигация по TeamOS</Dialog.Title>
            <Dialog.Description className="sr-only">
              Основные разделы приложения и настройки
            </Dialog.Description>
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="absolute top-4 right-3 rounded-md p-1 text-slate-400 hover:bg-slate-100"
              aria-label="Закрыть меню"
            >
              <X className="size-5" />
            </button>
            <SidebarContent collapsed={false} canToggle={false} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
