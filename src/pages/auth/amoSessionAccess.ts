import { ApiError } from '@/api/client';
import type { PublicAuthErrorView } from './publicAuthFlow';

export function isValidAmoAccountId(value: string): boolean {
  return /^[1-9][0-9]*$/.test(value);
}

export function safeAmoSessionRedirect(value: string): string | undefined {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return undefined;

  try {
    const base = new URL('https://teamos.invalid');
    const target = new URL(value, base);
    if (target.origin !== base.origin) return undefined;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return undefined;
  }
}

export function amoSessionAccessErrorView(error: unknown): PublicAuthErrorView {
  if (error instanceof ApiError && error.status === 403) {
    return {
      title: 'Недостаточно прав',
      description: 'Войти через amoCRM может только администратор или владелец компании TeamOS.',
      action: 'none',
    };
  }
  if (error instanceof ApiError && error.status === 404) {
    return {
      title: 'Компания не найдена',
      description: 'Для этого аккаунта amoCRM ещё не создана или не привязана компания TeamOS.',
      action: 'none',
    };
  }
  if (error instanceof ApiError && error.status === 409) {
    return {
      title: 'Не удалось подтвердить доступ',
      description: error.message,
      action: 'none',
    };
  }
  if (error instanceof ApiError && error.status === 423) {
    return {
      title: 'Доступ временно заблокирован',
      description: error.message,
      action: 'none',
    };
  }
  return {
    title: 'Не удалось открыть TeamOS',
    description: 'Проверьте подключение к интернету и повторите попытку.',
    action: 'retry',
  };
}
