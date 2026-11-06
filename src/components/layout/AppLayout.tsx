import { queryKeys } from '@/api/queryKeys';
import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useMediaQuery } from '@reactuses/core';
import { isHttpApiMode } from '@/api/config';
import { subscribeToNotifications } from '@/api/notificationsStream';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import { cn } from '@/lib/cn';
import { ErrorBoundary } from './ErrorBoundary';
import { resolveNavLocation } from './navigation';
import { ChromeSlotsProvider } from './pageChrome';
import { Rail } from './Rail';
import { SectionPanel } from './SectionPanel';
import { Topbar } from './Topbar';
import { useNavModel } from './useNavModel';

/**
 * Каркас приложения (концепт C): рейл разделов + панель раздела + шапка и контент.
 * До 1024 px панель раздела выезжает по кнопке меню, до 768 px — вместе с рейлом.
 */
export function AppLayout() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const { pathname, search } = useLocation();
  const navOpen = useUiStore((s) => s.navOpen);
  const setNavOpen = useUiStore((s) => s.setNavOpen);
  const wide = useMediaQuery('(min-width: 1024px)', true);
  const medium = useMediaQuery('(min-width: 768px)', true);
  const model = useNavModel();
  const location = resolveNavLocation(pathname);

  const [header, setHeader] = useState<HTMLDivElement | null>(null);
  const [actions, setActions] = useState<HTMLDivElement | null>(null);
  const [sectionContext, setSectionContext] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isHttpApiMode('notifications') || !accessToken) return;
    return subscribeToNotifications(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    });
  }, [accessToken, queryClient]);

  // Переход по навигации закрывает выезжающую панель.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname, search, setNavOpen]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen, setNavOpen]);

  const railHidden = !medium && !navOpen;
  const panelHidden = !wide && !navOpen;

  return (
    <ChromeSlotsProvider value={{ header, actions, sectionContext }}>
      <div className="flex h-dvh overflow-hidden">
        <div id="app-navigation" className="contents">
          <div
            inert={railHidden}
            className={cn(
              'h-full shrink-0 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:transition-transform max-md:duration-200',
              railHidden && 'max-md:-translate-x-full',
            )}
          >
            <Rail model={model} location={location} />
          </div>
          <div
            inert={panelHidden}
            className={cn(
              'h-full shrink-0 max-lg:fixed max-lg:inset-y-0 max-lg:left-[76px] max-lg:z-50 max-lg:shadow-popover max-lg:transition-transform max-lg:duration-200',
              panelHidden && 'max-lg:-translate-x-[calc(100%+76px)]',
            )}
          >
            <SectionPanel model={model} location={location} contextSlotRef={setSectionContext} />
          </div>
        </div>
        {navOpen && !wide && (
          <div
            className="animate-overlay-in fixed inset-0 z-40 bg-slate-950/30"
            onClick={() => setNavOpen(false)}
            aria-hidden="true"
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            location={location}
            currentUser={model.currentUser}
            headerSlotRef={setHeader}
            actionsSlotRef={setActions}
          />
          <main className="flex-1 overflow-y-auto">
            {/* key={pathname}: упавший раздел не роняет весь SPA, а переход в другой раздел сбрасывает ошибку. */}
            <ErrorBoundary key={pathname}>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </ChromeSlotsProvider>
  );
}
