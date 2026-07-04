import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Мок-API кидает 5% случайных ошибок — ретраи сглаживают их так же,
      // как будут сглаживать сетевые сбои реального бэкенда.
      retry: 2,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Мок-API не ходит в сеть — не даём TanStack Query приостанавливать
      // запросы, когда navigator.onLine врёт про офлайн. Убрать при
      // подключении реального бэкенда.
      networkMode: 'always',
    },
    mutations: {
      networkMode: 'always',
    },
  },
});
