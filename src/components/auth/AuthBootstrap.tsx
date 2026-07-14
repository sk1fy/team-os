import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authApi } from '@/api';
import { isHttpApiMode } from '@/api/config';
import { useAuthStore } from '@/stores/auth';

export function AuthBootstrap({ children }: { children: ReactNode }) {
  const initialized = useAuthStore((state) => state.initialized);
  const setInitialized = useAuthStore((state) => state.setInitialized);

  useEffect(() => {
    if (!isHttpApiMode('auth')) {
      setInitialized(true);
      return;
    }
    void authApi.refresh().finally(() => setInitialized(true));
  }, [setInitialized]);

  if (isHttpApiMode('auth') && !initialized) return null;
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
