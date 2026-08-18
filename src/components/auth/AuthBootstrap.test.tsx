import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AuthCheckingScreen } from './AuthBootstrap';
import { isAmoSessionAuthRoute, isPublicAuthTokenRoute } from './authRouteMode';
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

  it('восстанавливает first-party сессию для session-only входа из amoCRM', () => {
    expect(isPublicAuthTokenRoute('/auth/amocrm', '?sessionToken=legacy')).toBe(true);
    expect(isPublicAuthTokenRoute('/auth/amocrm', '?mode=session&accountId=31355990')).toBe(false);
    expect(isAmoSessionAuthRoute('/auth/amocrm', '?mode=session&accountId=31355990')).toBe(true);
  });
});
