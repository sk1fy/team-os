import { queryKeys } from '@/api/queryKeys';
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { isHttpApiMode } from '@/api/config';
import { subscribeToNotifications } from '@/api/notificationsStream';
import { useAuthStore } from '@/stores/auth';
import { ErrorBoundary } from './ErrorBoundary';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

/** Основной layout приложения: сайдбар + топбар + контент раздела. */
export function AppLayout() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const { pathname } = useLocation();

  useEffect(() => {
    if (!isHttpApiMode('notifications') || !accessToken) return;
    return subscribeToNotifications(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    });
  }, [accessToken, queryClient]);

  return (
    <div className="flex h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          {/* key={pathname}: упавший раздел не роняет весь SPA, а переход в другой раздел сбрасывает ошибку. */}
          <ErrorBoundary key={pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
