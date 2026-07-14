import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Мок-API кидает 5% случайных ошибок — ретраи сглаживают их так же,
      // как будут сглаживать сетевые сбои реального бэкенда.
      retry: 2,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});
