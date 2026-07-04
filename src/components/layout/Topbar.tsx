import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, LogOut, Menu, Search, Settings, UserRound } from 'lucide-react';
import { authApi, notificationsApi } from '@/api';
import { useUiStore } from '@/stores/ui';
import { Avatar, Dropdown } from '@/components/ui';

export function Topbar() {
  const navigate = useNavigate();
  const setMobileSidebarOpen = useUiStore((s) => s.setMobileSidebarOpen);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: authApi.getCurrentUser,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'unreadCount'],
    queryFn: notificationsApi.getUnreadCount,
    refetchInterval: 60_000,
  });

  const fullName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : '';

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-surface px-4">
      <button
        onClick={() => setMobileSidebarOpen(true)}
        className="rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
        aria-label="Открыть меню"
      >
        <Menu className="size-5" />
      </button>

      {/* Глобальный поиск (полная реализация — этап 5) */}
      <div className="relative max-w-md flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          placeholder="Поиск по компании…"
          className="h-9 w-full rounded-md border border-slate-200 bg-surface-muted pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary-400 focus:bg-surface"
        />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={() => navigate('/notifications')}
          className="relative rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label="Уведомления"
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-danger-500 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

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
            items={[
              {
                key: 'profile',
                label: 'Мой профиль',
                icon: UserRound,
                onSelect: () => navigate(`/employees/${currentUser.id}`),
              },
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
                onSelect: () => navigate('/auth/login'),
              },
            ]}
          />
        )}
      </div>
    </header>
  );
}
