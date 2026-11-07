import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AuthCheckingScreen, AuthUnavailableScreen } from './AuthBootstrap';
import { restoreAuthenticatedSession } from './sessionBootstrap';

describe('auth bootstrap', () => {
  it('показывает доступное состояние загрузки вместо пустого body', () => {
    const markup = renderToStaticMarkup(<AuthCheckingScreen />);

    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('Проверяем доступ…');
  });

  it('загружает currentUser до завершения восстановления сессии', async () => {
    const calls: string[] = [];
    const refresh = vi.fn(async () => {
      calls.push('refresh');
      return true;
    });
    const loadCurrentUser = vi.fn(async () => {
      calls.push('currentUser');
    });

    await restoreAuthenticatedSession(refresh, loadCurrentUser);

    expect(calls).toEqual(['refresh', 'currentUser']);
  });

  it('не запрашивает currentUser без восстановленной сессии', async () => {
    const loadCurrentUser = vi.fn(async () => undefined);

    await restoreAuthenticatedSession(async () => false, loadCurrentUser);

    expect(loadCurrentUser).not.toHaveBeenCalled();
  });
  it('keeps temporary bootstrap failure separate from sign-out', async () => {
    const loadCurrentUser = vi.fn();
    const { ApiError } = await import('@/api/client');
    const result = await restoreAuthenticatedSession(
      async () => ({ kind: 'unavailable', error: new ApiError('Временно недоступно', 503) }),
      loadCurrentUser,
    );
    expect(result.kind).toBe('unavailable');
    expect(loadCurrentUser).not.toHaveBeenCalled();
    const markup = renderToStaticMarkup(<AuthUnavailableScreen onRetry={() => undefined} />);
    expect(markup).toContain('Повторить');
    expect(markup).toContain('role="alert"');
  });
});
