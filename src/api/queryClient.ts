import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './client';
import { useAuthStore } from '@/stores/auth';

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Мок-API кидает 5% случайных ошибок — ретраи сглаживают их так же,
      // как будут сглаживать сетевые сбои реального бэкенда.
      retry: shouldRetryQuery,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

useAuthStore.subscribe((state, previous) => {
  if (state.epoch !== previous.epoch) queryClient.clear();
});
