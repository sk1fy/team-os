import { useEffect, useRef, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authApi } from '@/api';
import { isHttpApiMode } from '@/api/config';
import { useAuthStore } from '@/stores/auth';

export function AuthBootstrap({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const initialized = useAuthStore((state) => state.initialized);
  const setInitialized = useAuthStore((state) => state.setInitialized);
  const startedRef = useRef(false);
  const isPublicTokenRoute = pathname === '/onboarding' || pathname === '/register-company';

  useEffect(() => {
    if (isPublicTokenRoute || initialized) return;
    if (startedRef.current) return;
    startedRef.current = true;
    if (!isHttpApiMode('auth')) {
      setInitialized(true);
      return;
    }
    void authApi.refresh().finally(() => setInitialized(true));
  }, [initialized, isPublicTokenRoute, setInitialized]);

  if (isHttpApiMode('auth') && !initialized && !isPublicTokenRoute) return null;
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
