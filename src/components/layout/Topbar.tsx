import { queryKeys } from '@/api/queryKeys';
import { lazy, Suspense, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, LogOut, Menu, Settings, UserRound } from 'lucide-react';
import { notificationsApi } from '@/api';
import { isHttpApiMode } from '@/api/config';
import type { ID, User } from '@/types';
import { useUiStore } from '@/stores/ui';
import { Avatar, Dropdown, type DropdownItem } from '@/components/ui';
import { roleLabels } from '@/lib/labels';
import { useLogout } from '@/components/auth/useLogout';
import { isConnectedWidget, resolveActiveTab, type NavLocation } from './navigation';

const EmployeeDrawer = lazy(() =>
  import('@/pages/employees/EmployeeDrawer').then((module) => ({
    default: module.EmployeeDrawer,
  })),
);

/** Хлебные крошки и запасной заголовок, если страница не отрисовала `PageHeader`. */
function useHeading(location: NavLocation) {
  const { pathname, search } = useLocation();
  if (location.kind === 'widget') {
    const { widget, group } = location;
    const tab = resolveActiveTab(widget.tabs, pathname, search);
    return {
      crumb: isConnectedWidget(widget) ? `${group.title} › ${widget.title}` : group.title,
      fallback: tab?.label ?? widget.title,
    };
  }
  if (location.kind === 'section') {
    const tab = resolveActiveTab(location.section.tabs, pathname, search);
    return { crumb: null, fallback: tab?.label ?? location.section.title };
  }
  return { crumb: null, fallback: '' };
}

/**
 * Шапка: крошки, заголовок страницы (слот для `PageHeader`), действия страницы,
 * уведомления, роль и меню профиля.
 */
export function Topbar({
  location,
  currentUser,
  headerSlotRef,
  actionsSlotRef,
}: {
  location: NavLocation;
  currentUser: User | undefined;
  headerSlotRef: (node: HTMLDivElement | null) => void;
  actionsSlotRef: (node: HTMLDivElement | null) => void;
}) {
  const navigate = useNavigate();
  const logout = useLogout();
  const navOpen = useUiStore((s) => s.navOpen);
  const setNavOpen = useUiStore((s) => s.setNavOpen);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<ID | null>(null);
  const { crumb, fallback } = useHeading(location);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: notificationsApi.getUnreadCount,
    refetchInterval: isHttpApiMode('notifications') ? false : 60_000,
  });

  const fullName = currentUser
    ? [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ')
    : '';
  const accountItems: (DropdownItem | 'separator')[] = currentUser
    ? [
        ...(currentUser.role === 'employee'
          ? []
          : [
              {
                key: 'profile',
                label: 'Мой профиль',
                icon: UserRound,
                onSelect: () => setSelectedEmployeeId(currentUser.id),
              },
            ]),
        {
          key: 'settings',
          label: 'Настройки',
          icon: Settings,
          onSelect: () => navigate('/settings'),
        },
        'separator',
        {
          key: 'logout',
          label: 'Выйти',
          icon: LogOut,
          danger: true,
          onSelect: () => void logout(),
        },
      ]
    : [];

  return (
    <header className="z-30 flex min-h-[76px] shrink-0 flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-slate-200 bg-surface px-6 py-3 max-md:min-h-16 max-md:px-4">
      <button
        id="nav-trigger"
        type="button"
        onClick={() => setNavOpen(!navOpen)}
        className="flex size-9.5 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 lg:hidden"
        aria-label="Открыть навигацию"
        aria-expanded={navOpen}
        aria-controls="app-navigation"
      >
        <Menu className="size-4.5" />
      </button>

      <div className="min-w-0 flex-1">
        {crumb && <div className="mb-0.5 truncate text-xs font-medium text-slate-500">{crumb}</div>}
        <div ref={headerSlotRef} className="peer min-w-0" />
        <h1 className="hidden truncate text-[21px] leading-tight font-bold tracking-[-0.4px] text-ink peer-empty:block max-md:text-[19px]">
          {fallback}
        </h1>
      </div>

      <div
        ref={actionsSlotRef}
        className="flex items-center gap-2 empty:hidden max-md:order-last max-md:w-full max-md:pb-1"
      />

      <div className="ml-auto flex shrink-0 items-center gap-2.5">
        <button
          onClick={() => navigate('/notifications')}
          className="relative flex size-9.5 items-center justify-center rounded-md border border-slate-200 bg-surface text-slate-500 transition-colors hover:border-primary-200 hover:text-primary-600"
          aria-label={unreadCount > 0 ? `Уведомления: ${unreadCount} новых` : 'Уведомления'}
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full border-2 border-surface bg-danger-600 px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {currentUser && (
          <div className="hidden items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-[13px] font-semibold text-slate-700 md:flex">
            <span className="size-1.5 rounded-full bg-primary-600 dark:bg-primary-400" />
            {roleLabels[currentUser.role]}
          </div>
        )}

        {currentUser && (
          <Dropdown
            trigger={
              <button
                className="rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                aria-label="Меню профиля"
              >
                <Avatar name={fullName} src={currentUser.avatarUrl} size="sm" />
              </button>
            }
            items={accountItems}
          />
        )}
      </div>
      {selectedEmployeeId && (
        <Suspense fallback={null}>
          <EmployeeDrawer userId={selectedEmployeeId} onClose={() => setSelectedEmployeeId(null)} />
        </Suspense>
      )}
    </header>
  );
}
