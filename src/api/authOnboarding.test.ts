import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { httpAuthApi } from './http';
import { useAuthStore } from '@/stores/auth';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const wireUser = {
  id: 'user-1',
  email: 'owner@example.com',
  firstName: 'Иван',
  lastName: 'Петров',
  role: 'owner',
  status: 'active',
  positionIds: [],
  createdAt: '2026-08-07T10:00:00Z',
} as const;

const participant = {
  userId: 'user-2',
  email: 'admin@example.com',
  firstName: 'Анна',
  lastName: 'Смирнова',
  role: 'admin',
  status: 'invited',
} as const;

beforeEach(() => {
  useAuthStore.setState({ accessToken: null, initialized: false });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('onboarding auth API', () => {
  it('загружает bootstrap публично и нормализует userId', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        companyId: 'company-1',
        companyName: 'Ракурс',
        companyStatus: 'onboarding',
        expiresAt: '2026-08-08T10:00:00Z',
        state: 'pending',
        user: participant,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await httpAuthApi.getBootstrapActivation('secret/token');

    expect(result.user).toMatchObject({ id: 'user-2', role: 'admin' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:8080/api/v1/auth/bootstrap/secret%2Ftoken');
    expect(new Headers(init.headers).has('Authorization')).toBe(false);
  });

  it('устанавливает сессию и возвращает второго участника после активации', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          accessToken: 'bootstrap-access',
          user: wireUser,
          onboarding: {
            companyId: 'company-1',
            companyStatus: 'onboarding',
            completed: false,
            pendingUser: participant,
            activationUrl: 'https://company.example/onboarding?token=next',
            expiresAt: '2026-08-08T10:00:00Z',
          },
        }),
      ),
    );

    const result = await httpAuthApi.completeBootstrapActivation('bootstrap-token', {
      password: 'reliable-password',
    });

    expect(useAuthStore.getState()).toMatchObject({
      accessToken: 'bootstrap-access',
      initialized: true,
    });
    expect(result.onboarding.pendingUser?.id).toBe('user-2');
  });

  it('обменивает SSO-токен ровно в body и запоминает access token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ accessToken: 'sso-access', user: wireUser }));
    vi.stubGlobal('fetch', fetchMock);

    await httpAuthApi.exchangeSso('one-time-sso');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:8080/api/v1/auth/sso/exchange');
    expect(JSON.parse(String(init.body))).toEqual({ token: 'one-time-sso' });
    expect(new Headers(init.headers).has('Authorization')).toBe(false);
    expect(useAuthStore.getState().accessToken).toBe('sso-access');
  });

  it('читает и перевыпускает onboarding с внутренней авторизацией', async () => {
    useAuthStore.getState().setAccessToken('internal-access');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          companyId: 'company-1',
          companyStatus: 'onboarding',
          completed: false,
          pendingUser: participant,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          companyId: 'company-1',
          companyStatus: 'onboarding',
          completed: false,
          pendingUser: participant,
          activationUrl: 'https://company.example/onboarding?token=reissued',
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(httpAuthApi.getOnboardingStatus()).resolves.toMatchObject({
      pendingUser: { id: 'user-2' },
    });
    await expect(httpAuthApi.reissueOnboardingActivation()).resolves.toMatchObject({
      activationUrl: expect.stringContaining('reissued'),
    });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:8080/api/v1/company/onboarding',
      'http://localhost:8080/api/v1/company/onboarding/activation',
    ]);
    for (const [, init] of fetchMock.mock.calls as [string, RequestInit][]) {
      expect(new Headers(init.headers).get('Authorization')).toBe('Bearer internal-access');
    }
  });
});
