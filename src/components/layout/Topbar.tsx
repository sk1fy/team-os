import { queryKeys } from '@/api/queryKeys';
import { lazy, Suspense, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, LogOut, Menu, Settings, UserRound } from 'lucide-react';
import { authApi, notificationsApi } from '@/api';
import { isHttpApiMode } from '@/api/config';
import type { ID } from '@/types';
import { useUiStore } from '@/stores/ui';
import { Avatar, Dropdown, type DropdownItem } from '@/components/ui';
import { roleLabels } from '@/lib/labels';
import { useLogout } from '@/components/auth/useLogout';

const EmployeeDrawer = lazy(() =>
  import('@/pages/employees/EmployeeDrawer').then((module) => ({
    default: module.EmployeeDrawer,
  })),
);

export function Topbar() {
  const navigate = useNavigate();
  const logout = useLogout();
  const setMobileSidebarOpen = useUiStore((s) => s.setMobileSidebarOpen);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<ID | null>(null);

  const { data: currentUser } = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: authApi.getCurrentUser,
  });

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
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-surface px-4">
      <button
        id="mobile-sidebar-trigger"
        type="button"
        onClick={() => setMobileSidebarOpen(true)}
        className="rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
        aria-label="Открыть меню"
      >
        <Menu className="size-5" />
      </button>

      <div className="flex-1" />

      <div className="ml-auto flex items-center gap-3">
        <button
          onClick={() => navigate('/notifications')}
          className="relative flex size-9.5 items-center justify-center rounded-md border border-slate-200 bg-surface text-slate-500 transition-colors hover:border-primary-200 hover:text-primary-600"
          aria-label="Уведомления"
        >
          <Bell className="size-4.5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full border-2 border-surface bg-danger-600 px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {currentUser && (
          <div className="hidden items-center gap-2 rounded-md bg-primary-50 px-3 py-2 text-[13px] font-medium text-slate-700 md:flex">
            <span className="size-[7px] rounded-full bg-primary-600" />
            {roleLabels[currentUser.role]}
          </div>
        )}

        {currentUser && (
          <Dropdown
            trigger={
              <button
                className="ml-1 rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
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
