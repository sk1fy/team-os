import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth';

let client: typeof import('./client');
let http: typeof import('./http');
const sessionId = '10000000-0000-4000-8000-000000000001';
const session = { accessToken: 'fresh', sessionId, user: { id: 'u' } };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(async () => {
  vi.resetModules();
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    key: (index: number) => [...storage.keys()][index] ?? null,
    get length() {
      return storage.size;
    },
  });
  client = await import('./client');
  http = await import('./http');
  (await import('@/stores/auth')).useAuthStore.getState().setAccessToken('usable');
});
afterEach(() => {
  vi.unstubAllGlobals();
  useAuthStore.getState().clear();
});

async function token() {
  return (await import('@/stores/auth')).useAuthStore.getState().accessToken;
}

describe('auth operation ordering', () => {
  it.each([429, 500, 503])('preserves usable credentials on refresh %i', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}, status)));
    expect(await client.refreshAccessToken()).toBe(false);
    expect(await token()).toBe('usable');
  });

  it('discovers the HttpOnly selector on first refresh, then captures the returned route for logout', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(session))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await client.refreshSession()).kind).toBe('ready');
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get('X-Teamos-Session')).toBeNull();
    await client.logoutSession();
    expect(new Headers(fetchMock.mock.calls[1][1].headers).get('X-Teamos-Session')).toBe(sessionId);
  });

  it('keeps malformed and lost refresh responses retryable', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValueOnce(new TypeError('connection lost'))
        .mockResolvedValueOnce(response({ accessToken: '' }))
        .mockResolvedValueOnce(response(session)),
    );
    expect((await client.refreshSession()).kind).toBe('unavailable');
    expect((await client.refreshSession()).kind).toBe('unavailable');
    expect(await token()).toBe('usable');
    expect((await client.refreshSession()).kind).toBe('ready');
  });

  it('clears authority on definitive refresh 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}, 401)));
    expect((await client.refreshSession()).kind).toBe('signed-out');
    expect(await token()).toBeNull();
  });

  it('logout invalidates a delayed refresh before its body arrives', async () => {
    const body = deferred<Response>();
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(body.promise)
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const refreshing = client.refreshAccessToken();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const loggingOut = http.httpAuthApi.logout();
    expect(await token()).toBeNull();
    body.resolve(response(session));
    expect(await refreshing).toBe(false);
    await loggingOut;
    expect(await token()).toBeNull();
    expect(new Headers(fetchMock.mock.calls[1][1].headers).get('X-Teamos-Session')).toBe(sessionId);
  });

  it('does not start queued refresh after logout', async () => {
    const entered = deferred<void>();
    const release = deferred<typeof session>();
    const entry = client.establishSession(async () => {
      entered.resolve();
      return release.promise;
    });
    const caughtEntry = entry.catch((error: unknown) => error);
    await entered.promise;
    const refreshing = client.refreshSession();
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const loggingOut = client.logoutSession();
    release.resolve(session);
    expect(await caughtEntry).toMatchObject({ code: 'AUTH_SUPERSEDED' });
    expect((await refreshing).kind).toBe('superseded');
    await loggingOut;
    expect(fetchMock.mock.calls.every(([url]) => String(url).endsWith('/auth/logout'))).toBe(true);
    expect(await token()).toBeNull();
  });

  it('keeps pending logout on failure and retries its captured family after reload', async () => {
    await client.establishSession(async () => session);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({}, 503))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(client.logoutSession()).rejects.toMatchObject({ status: 503 });
    vi.resetModules();
    client = await import('./client');
    expect((await client.refreshSession()).kind).toBe('signed-out');
    await client.retryPendingLogout();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchMock.mock.calls) {
      expect(new Headers(init.headers).get('X-Teamos-Session')).toBe(sessionId);
    }
  });

  it('still attempts server revocation when storage writes are denied', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('denied');
      },
      length: 0,
    });
    const fetchMock = vi.fn().mockResolvedValue(response({}, 503));
    vi.stubGlobal('fetch', fetchMock);
    await expect(client.logoutSession()).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await token()).toBeNull();
  });

  it('blocks fresh login until pending logout succeeds', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({}, 503));
    vi.stubGlobal('fetch', fetchMock);
    await expect(client.logoutSession()).rejects.toMatchObject({ status: 503 });
    const login = vi.fn(async () => session);
    await expect(client.establishSession(login)).rejects.toMatchObject({ status: 503 });
    expect(login).not.toHaveBeenCalled();
    expect(await token()).toBeNull();
  });

  it.each(['json', 'blob', 'sse'])(
    'does not replay an old %s request under a new login',
    async (kind) => {
      const original = deferred<Response>();
      const fetchMock = vi.fn().mockReturnValueOnce(original.promise);
      vi.stubGlobal('fetch', fetchMock);
      const request =
        kind === 'json'
          ? client.httpRequest('/work')
          : kind === 'blob'
            ? client.httpBlobRequest('/work')
            : client.openEventStream('/work', new AbortController().signal);
      const caught = request.catch((error: unknown) => error);
      await client.establishSession(async () => session);
      original.resolve(response({}, 401));
      expect(await caught).toMatchObject({ code: 'AUTH_SUPERSEDED' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(await token()).toBe('fresh');
    },
  );

  it.each(['json', 'blob', 'sse'])(
    'rejects successful old %s response after a new login',
    async (kind) => {
      const oldBody = deferred<Response>();
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(oldBody.promise));
      const request =
        kind === 'json'
          ? client.httpRequest('/work')
          : kind === 'blob'
            ? client.httpBlobRequest('/work')
            : client.openEventStream('/work', new AbortController().signal);
      const caught = request.catch((error: unknown) => error);
      await client.establishSession(async () => session);
      oldBody.resolve(response({ privateOldAccount: true }));
      expect(await caught).toMatchObject({ code: 'AUTH_SUPERSEDED' });
    },
  );

  it.each(['json', 'blob'])(
    'rejects old %s body when its headers arrived before login',
    async (kind) => {
      const body = deferred<string>();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(
            new ReadableStream({
              async start(controller) {
                controller.enqueue(new TextEncoder().encode('{'));
                controller.enqueue(new TextEncoder().encode(await body.promise));
                controller.close();
              },
            }),
          ),
        ),
      );
      const request =
        kind === 'json' ? client.httpRequest('/work') : client.httpBlobRequest('/work');
      const caught = request.catch((error: unknown) => error);
      await client.establishSession(async () => session);
      body.resolve('"privateOldAccount":true}');
      expect(await caught).toMatchObject({ code: 'AUTH_SUPERSEDED' });
    },
  );

  it('rejects SSE chunks from an old epoch after the stream was opened', async () => {
    const chunk = deferred<Uint8Array>();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          new ReadableStream<Uint8Array>({
            async start(controller) {
              controller.enqueue(await chunk.promise);
              controller.close();
            },
          }),
        ),
      ),
    );
    const stream = await client.openEventStream('/sse', new AbortController().signal);
    const reading = stream
      .body!.getReader()
      .read()
      .catch((error: unknown) => error);
    await client.establishSession(async () => session);
    chunk.resolve(new TextEncoder().encode('data: private-old-account\n\n'));
    expect(await reading).toMatchObject({ code: 'AUTH_SUPERSEDED' });
  });

  it('clears cached account data on entry, definitive expiry and another tab epoch', async () => {
    const { queryClient } = await import('./queryClient');
    queryClient.setQueryData(['tasks'], [{ privateOldAccount: true }]);
    await client.establishSession(async () => session);
    expect(queryClient.getQueryData(['tasks'])).toBeUndefined();
    queryClient.setQueryData(['tasks'], [{ privateOldAccount: true }]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}, 401)));
    await client.refreshSession();
    expect(queryClient.getQueryData(['tasks'])).toBeUndefined();
    await client.establishSession(async () => session);
    queryClient.setQueryData(['tasks'], [{ privateOldAccount: true }]);
    const marker = localStorage.getItem('teamos.auth.logout');
    const logoutEpoch = marker ? JSON.parse(marker).epoch : null;
    localStorage.setItem(
      client.AUTH_INTENT_KEY,
      JSON.stringify({ kind: 'active', epoch: 'another-tab', sessionId, logoutEpoch }),
    );
    client.captureAuthEpoch();
    expect(queryClient.getQueryData(['tasks'])).toBeUndefined();
    queryClient.clear();
  });

  it('a normalized onboarding continuation cannot restore or cache its session after logout', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ ...session, onboarding: { completed: false } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const activation = await http.httpAuthApi.completeBootstrapActivation('fixture', {
      password: 'secret',
    });
    await client.logoutSession();
    const cache = vi.fn();
    expect(() => {
      client.assertCurrentSession(activation);
      cache(activation);
    }).toThrowError();
    expect(cache).not.toHaveBeenCalled();
    expect(await token()).toBeNull();
  });

  it('a request started during pending login cannot replay as the new account', async () => {
    const entryBody = deferred<typeof session>();
    const started = deferred<void>();
    const entry = client.establishSession(async () => {
      started.resolve();
      return entryBody.promise;
    });
    await started.promise;
    const oldResponse = deferred<Response>();
    const fetchMock = vi.fn().mockReturnValue(oldResponse.promise);
    vi.stubGlobal('fetch', fetchMock);
    const oldRequest = client.httpRequest('/work').catch((error: unknown) => error);
    entryBody.resolve(session);
    await entry;
    oldResponse.resolve(response({}, 401));
    expect(await oldRequest).toMatchObject({ code: 'AUTH_SUPERSEDED' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shares one refresh and one retry across JSON, blob and SSE callers', async () => {
    const refreshed = deferred<Response>();
    const fetchMock = vi.fn((url: string, init: RequestInit) => {
      if (url.endsWith('/auth/refresh')) return refreshed.promise;
      if (new Headers(init.headers).get('Authorization') === 'Bearer usable') {
        return Promise.resolve(response({}, 401));
      }
      return Promise.resolve(response({ ok: true }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const results = Promise.all([
      client.httpRequest('/json'),
      client.httpBlobRequest('/blob'),
      client.openEventStream('/sse', new AbortController().signal),
    ]);
    await vi.waitFor(() =>
      expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/auth/refresh'))).toHaveLength(1),
    );
    refreshed.resolve(response(session));
    await results;
    expect(fetchMock).toHaveBeenCalledTimes(7);
    for (const path of ['/json', '/blob', '/sse']) {
      expect(fetchMock.mock.calls.filter(([url]) => url.endsWith(path))).toHaveLength(2);
    }
  });

  it('a logout marker wins even if a stale active intent is published afterward', async () => {
    localStorage.setItem(
      'teamos.auth.logout',
      JSON.stringify({ kind: 'signed-out', epoch: 'logout-wins' }),
    );
    localStorage.setItem(
      client.AUTH_INTENT_KEY,
      JSON.stringify({ kind: 'active', epoch: 'late-login', sessionId, logoutEpoch: null }),
    );
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await client.refreshSession()).kind).toBe('signed-out');
    expect(client.captureAuthEpoch()).toBe('logout-wins');
    expect(await token()).toBeNull();
    await client.retryPendingLogout();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not disguise refresh 503 as the original request 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(response({}, 401)).mockResolvedValueOnce(response({}, 503)),
    );
    await expect(client.httpRequest('/work')).rejects.toMatchObject({ status: 503 });
    expect(await token()).toBe('usable');
  });

  it('scopes refresh promises to their epoch and preserves a newer queued promise', async () => {
    const first = deferred<Response>();
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(response(session));
    vi.stubGlobal('fetch', fetchMock);
    const oldRefresh = client.refreshSession();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    localStorage.setItem(
      client.AUTH_INTENT_KEY,
      JSON.stringify({ kind: 'active', epoch: 'other-login', sessionId }),
    );
    const newRefresh = client.refreshSession();
    expect(newRefresh).not.toBe(oldRefresh);
    first.resolve(response({}, 401));
    expect((await oldRefresh).kind).toBe('superseded');
    expect(client.refreshSession()).toBe(newRefresh);
    expect((await newRefresh).kind).toBe('ready');
    expect(await token()).toBe('fresh');
  });
});
