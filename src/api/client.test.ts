import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, httpRequest } from './client';
import { useAuthStore } from '@/stores/auth';

afterEach(() => {
  vi.unstubAllGlobals();
  useAuthStore.setState({ accessToken: null, initialized: false });
});

describe('httpRequest', () => {
  it('передаёт access-токен и credentials', async () => {
    useAuthStore.getState().setAccessToken('access-token');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'user-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(httpRequest<{ id: string }>('/auth/me')).resolves.toEqual({ id: 'user-1' });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe('include');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer access-token');
  });

  it('преобразует ответ gateway в ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'Нет доступа', status: 403 } }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const promise = httpRequest('/kb/articles', {}, { skipAuthRefresh: true });
    await expect(promise).rejects.toMatchObject({ message: 'Нет доступа', status: 403 });
  });

  it('парсит structured code, details и requestId', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              message: 'Курс заблокирован',
              status: 403,
              code: 'COURSE_BLOCKED',
              details: { courseId: 'c-1' },
            },
            requestId: 'req-123',
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json', 'x-request-id': 'header-req' },
          },
        ),
      ),
    );

    try {
      await httpRequest('/academy/v2/courses/c-1', {}, { skipAuthRefresh: true });
      throw new Error('expected ApiError');
    } catch (error) {
      if (error instanceof Error && error.message === 'expected ApiError') throw error;
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.code).toBe('COURSE_BLOCKED');
      expect(apiError.details).toEqual({ courseId: 'c-1' });
      expect(apiError.requestId).toBe('req-123');
      expect(apiError.status).toBe(403);
    }
  });

  it('authMode external/none не отправляет internal Bearer', async () => {
    useAuthStore.getState().setAccessToken('secret-internal-token');
    const ok = () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    const fetchMock = vi.fn().mockResolvedValueOnce(ok()).mockResolvedValueOnce(ok());
    vi.stubGlobal('fetch', fetchMock);

    await httpRequest('/public/academy/access/tok', {}, { authMode: 'none' });
    await httpRequest('/public/academy/enrollments/e1', {}, { authMode: 'external' });

    for (const call of fetchMock.mock.calls) {
      const init = call[1] as RequestInit;
      expect(new Headers(init.headers).get('Authorization')).toBeNull();
    }
  });

  it('authMode external не делает internal refresh после 401', async () => {
    useAuthStore.getState().setAccessToken('secret-internal-token');
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      httpRequest('/public/academy/enrollments/e1', {}, { authMode: 'external' }),
    ).rejects.toMatchObject({ status: 401 });
    // Only the original request — no /auth/refresh
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('/auth/refresh');
  });

  it('один раз обновляет токен после 401 и повторяет запрос', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: 'rotated', user: { id: 'user-1' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 'user-1' }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(httpRequest<Array<{ id: string }>>('/org/users')).resolves.toEqual([
      { id: 'user-1' },
    ]);
    expect(useAuthStore.getState().accessToken).toBe('rotated');
    const [, retryInit] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(new Headers(retryInit.headers).get('Authorization')).toBe('Bearer rotated');
  });
});
