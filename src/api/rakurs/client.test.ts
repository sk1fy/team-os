import { afterEach, describe, expect, it, vi } from 'vitest';
import { RakursApiError, rakursPost } from './client';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('rakursPost', () => {
  it('добавляет account id и имя приложения в JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await rakursPost('https://example.test/api/', '/settings/get', {
      accountId: '31355990',
      appName: 'rkrs_activity',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.test/api/settings/get');
    expect(JSON.parse(String(options.body))).toEqual({
      amo_account_id: '31355990',
      app_name: 'rkrs_activity',
    });
  });

  it('не выполняет запрос без amoCRM Account ID', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      rakursPost('https://example.test', 'settings/get', {
        accountId: ' ',
        appName: 'rkrs_activity',
      }),
    ).rejects.toBeInstanceOf(RakursApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('преобразует error envelope старого API в исключение', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ response: 'error', message: 'Нет доступа' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(
      rakursPost('https://example.test', 'settings/get', {
        accountId: '1',
        appName: 'rkrs_activity',
      }),
    ).rejects.toMatchObject({ message: 'Нет доступа' });
  });
});
