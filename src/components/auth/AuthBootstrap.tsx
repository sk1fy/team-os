import { useEffect, useRef, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api';
import { isHttpApiMode } from '@/api/config';
import { queryKeys } from '@/api/queryKeys';
import { safeHomePath } from '@/lib/permissions';
import { useAuthStore } from '@/stores/auth';
import { restoreAuthenticatedSession } from './sessionBootstrap';

export function AuthCheckingScreen() {
  return (
    <main
      className="flex min-h-dvh items-center justify-center bg-page text-sm text-slate-500"
      aria-busy="true"
      aria-live="polite"
    >
      Проверяем доступ…
    </main>
  );
}

export function AuthBootstrap({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const initialized = useAuthStore((state) => state.initialized);
  const setInitialized = useAuthStore((state) => state.setInitialized);
  const queryClient = useQueryClient();
  const startedRef = useRef(false);
  const isPublicTokenRoute =
    pathname === '/onboarding' || pathname === '/register-company' || pathname === '/auth/amocrm';

  useEffect(() => {
    if (isPublicTokenRoute || initialized) return;
    if (startedRef.current) return;
    startedRef.current = true;
    if (!isHttpApiMode('auth')) {
      setInitialized(true);
      return;
    }
    void restoreAuthenticatedSession(authApi.refresh, () =>
      queryClient.fetchQuery({
        queryKey: queryKeys.currentUser,
        queryFn: authApi.getCurrentUser,
      }),
    ).finally(() => setInitialized(true));
  }, [initialized, isPublicTokenRoute, queryClient, setInitialized]);

  if (isHttpApiMode('auth') && !initialized && !isPublicTokenRoute) {
    return <AuthCheckingScreen />;
  }
  return children;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const accessToken = useAuthStore((state) => state.accessToken);
  if (isHttpApiMode('auth') && !accessToken) {
    return <Navigate to="/auth/login" replace state={{ from: location }} />;
  }
  return children;
}

export function RedirectAuthenticated({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const shouldCheckSession = isHttpApiMode('auth') && Boolean(accessToken);
  const currentUserQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: authApi.getCurrentUser,
    enabled: shouldCheckSession,
  });

  if (!shouldCheckSession || currentUserQuery.isError) return children;
  if (!currentUserQuery.data) return null;

  return (
    <Navigate
      to={safeHomePath(currentUserQuery.data.role, currentUserQuery.data.sectionAccess)}
      replace
    />
  );
}
