import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api';
import { refreshSession } from '@/api/client';
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

export function AuthUnavailableScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-page text-sm"
      role="alert"
    >
      <p>Не удалось проверить доступ. Проверьте соединение и попробуйте ещё раз.</p>
      <button type="button" onClick={onRetry}>
        Повторить
      </button>
    </main>
  );
}

export function AuthBootstrap({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const initialized = useAuthStore((state) => state.initialized);
  const setInitialized = useAuthStore((state) => state.setInitialized);
  const queryClient = useQueryClient();
  const startedRef = useRef(false);
  const [unavailable, setUnavailable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const isPublicTokenRoute =
    pathname === '/onboarding' ||
    pathname === '/register-company' ||
    pathname === '/auth/amocrm' ||
    pathname === '/auth/amo';

  useEffect(() => {
    if (isPublicTokenRoute || initialized) return;
    if (startedRef.current) return;
    startedRef.current = true;
    if (!isHttpApiMode('auth')) {
      setInitialized(true);
      return;
    }
    void restoreAuthenticatedSession(refreshSession, () =>
      queryClient.fetchQuery({
        queryKey: queryKeys.currentUser,
        queryFn: authApi.getCurrentUser,
      }),
    ).then((outcome) => {
      if (outcome.kind === 'unavailable') setUnavailable(true);
      else setInitialized(true);
    });
  }, [initialized, isPublicTokenRoute, queryClient, setInitialized, attempt]);

  if (unavailable && !isPublicTokenRoute) {
    return (
      <AuthUnavailableScreen
        onRetry={() => {
          startedRef.current = false;
          setUnavailable(false);
          setAttempt((value) => value + 1);
        }}
      />
    );
  }
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
