import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { isHttpApiMode } from '@/api/config';
import { subscribeToNotifications } from '@/api/notificationsStream';
import { useAuthStore } from '@/stores/auth';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

/** Основной layout приложения: сайдбар + топбар + контент раздела. */
export function AppLayout() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);

  useEffect(() => {
    if (!isHttpApiMode('notifications') || !accessToken) return;
    return subscribeToNotifications(() => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });
  }, [accessToken, queryClient]);

  return (
    <div className="flex h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
