import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  BookOpen,
  CheckSquare,
  GraduationCap,
  LogOut,
  Menu,
  Search,
  Settings,
  UserRound,
} from 'lucide-react';
import { academyApi, authApi, kbApi, notificationsApi, orgApi, tasksApi } from '@/api';
import { isHttpApiMode } from '@/api/config';
import type { ID } from '@/types';
import { useUiStore } from '@/stores/ui';
import { Avatar, Dropdown } from '@/components/ui';
import { fullName as formatFullName, roleLabels } from '@/lib/labels';
import { richTextToPlainText } from '@/lib/richText';
import { EmployeeDrawer } from '@/pages/employees/EmployeeDrawer';
import { cn } from '@/lib/cn';
import { useLogout } from '@/components/auth/useLogout';

type SearchResult = {
  id: string;
  title: string;
  subtitle: string;
  to: string;
  group: 'Сотрудники' | 'Статьи' | 'Задачи' | 'Курсы';
  icon: typeof UserRound;
  employeeId?: ID;
};

export function Topbar() {
  const navigate = useNavigate();
  const logout = useLogout();
  const setMobileSidebarOpen = useUiStore((s) => s.setMobileSidebarOpen);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<ID | null>(null);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: authApi.getCurrentUser,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'unreadCount'],
    queryFn: notificationsApi.getUnreadCount,
    refetchInterval: isHttpApiMode('notifications') ? false : 60_000,
  });

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: orgApi.getUsers });
  const articlesQuery = useQuery({
    queryKey: ['kb', 'articles'],
    queryFn: () => kbApi.getArticles(),
  });
  const tasksQuery = useQuery({
    queryKey: ['tasks', 'global'],
    queryFn: () => tasksApi.getTasks(),
    enabled: Boolean(currentUser && currentUser.role !== 'employee'),
  });
  const coursesQuery = useQuery({
    queryKey: ['academy', 'courses'],
    queryFn: academyApi.getCourses,
  });

  const fullName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : '';
  const query = search.trim().toLowerCase();

  const searchResults = useMemo(() => {
    if (!query) return [];

    const results: SearchResult[] = [];
    for (const user of currentUser?.role === 'employee' ? [] : (usersQuery.data ?? [])) {
      const haystack = `${formatFullName(user)} ${user.email}`.toLowerCase();
      if (haystack.includes(query)) {
        results.push({
          id: user.id,
          title: formatFullName(user),
          subtitle: user.email,
          to: '/employees',
          group: 'Сотрудники',
          icon: UserRound,
          employeeId: user.id,
        });
      }
    }

    for (const article of articlesQuery.data ?? []) {
      const haystack = `${article.title} ${richTextToPlainText(article.content)}`.toLowerCase();
      if (haystack.includes(query)) {
        results.push({
          id: article.id,
          title: article.title,
          subtitle: article.status === 'published' ? 'Опубликована' : 'Черновик',
          to: '/knowledge',
          group: 'Статьи',
          icon: BookOpen,
        });
      }
    }

    for (const task of currentUser?.role === 'employee' ? [] : (tasksQuery.data ?? [])) {
      const haystack = `${task.title} ${richTextToPlainText(task.description)}`.toLowerCase();
      if (haystack.includes(query)) {
        results.push({
          id: task.id,
          title: task.title,
          subtitle: task.completedAt ? 'Завершена' : 'Открыта',
          to: '/tasks',
          group: 'Задачи',
          icon: CheckSquare,
        });
      }
    }

    for (const course of coursesQuery.data ?? []) {
      const haystack = `${course.title} ${course.description ?? ''}`.toLowerCase();
      if (haystack.includes(query)) {
        results.push({
          id: course.id,
          title: course.title,
          subtitle: course.status === 'published' ? 'Опубликован' : 'Черновик',
          to: '/academy',
          group: 'Курсы',
          icon: GraduationCap,
        });
      }
    }

    return results.slice(0, 10);
  }, [
    articlesQuery.data,
    coursesQuery.data,
    currentUser?.role,
    query,
    tasksQuery.data,
    usersQuery.data,
  ]);

  const openResult = (result: SearchResult) => {
    if (result.employeeId) setSelectedEmployeeId(result.employeeId);
    else navigate(result.to);
    setSearch('');
    setSearchOpen(false);
  };

  const isSearching =
    usersQuery.isPending ||
    articlesQuery.isPending ||
    (currentUser?.role !== 'employee' && tasksQuery.isPending) ||
    coursesQuery.isPending;

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

      <div className="relative min-w-0 max-w-md flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          placeholder="Поиск по компании…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && searchResults[0]) openResult(searchResults[0]);
            if (event.key === 'Escape') setSearchOpen(false);
          }}
          className="h-9.5 w-full rounded-md border border-slate-200 bg-surface pl-9 pr-3 text-sm transition-colors focus:outline-2 focus:-outline-offset-1 focus:outline-primary-600"
        />
        {searchOpen && query && (
          <div className="animate-popover-in absolute top-full left-0 z-40 mt-2 w-[min(32rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-slate-200 bg-surface shadow-popover">
            <div className="max-h-96 overflow-y-auto p-1">
              {isSearching && searchResults.length === 0 && (
                <div className="space-y-2 p-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-10 animate-pulse rounded bg-slate-100" />
                  ))}
                </div>
              )}
              {!isSearching && searchResults.length === 0 && (
                <p className="px-3 py-4 text-sm text-slate-500">Ничего не найдено.</p>
              )}
              {searchResults.map((result, index) => {
                const Icon = result.icon;
                const showGroup = index === 0 || searchResults[index - 1]?.group !== result.group;
                return (
                  <div key={`${result.group}-${result.id}`}>
                    {showGroup && (
                      <div className="px-3 pt-3 pb-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                        {result.group}
                      </div>
                    )}
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => openResult(result)}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-slate-50',
                      )}
                    >
                      <Icon className="mt-0.5 size-4 shrink-0 text-slate-400" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-900">
                          {result.title}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {result.subtitle}
                        </span>
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

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
            items={[
              {
                key: 'profile',
                label: 'Мой профиль',
                icon: UserRound,
                onSelect: () => setSelectedEmployeeId(currentUser.id),
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
                onSelect: () => void logout(),
              },
            ]}
          />
        )}
      </div>
      <EmployeeDrawer userId={selectedEmployeeId} onClose={() => setSelectedEmployeeId(null)} />
    </header>
  );
}
