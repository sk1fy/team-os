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
  login: 'tm8901912',
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

  it('проверяет registration-токен публично и не меняет сессию', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        valid: true,
        state: 'valid',
        amoAccountId: '31355990',
        expiresAt: '2026-08-10T12:00:00Z',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      httpAuthApi.validateCompanyRegistrationToken('one-time-registration-token'),
    ).resolves.toMatchObject({ valid: true, state: 'valid', amoAccountId: '31355990' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:8080/api/v1/public/company-registration-tokens/validate');
    expect(JSON.parse(String(init.body))).toEqual({
      registrationToken: 'one-time-registration-token',
    });
    expect(new Headers(init.headers).has('Authorization')).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('передаёт тот же registration-токен при регистрации', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ accessToken: 'registered-access', user: wireUser }, 201));
    vi.stubGlobal('fetch', fetchMock);

    await httpAuthApi.register({
      companyName: 'ООО Ромашка',
      email: 'owner@example.com',
      password: 'long-password',
      firstName: 'Иван',
      lastName: 'Петров',
      registrationToken: 'one-time-registration-token',
      loginReservationToken: 'login-reservation-token-abcdefghijklmnopqrstuvwxyz',
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:8080/api/v1/auth/register');
    expect(JSON.parse(String(init.body))).toMatchObject({
      companyName: 'ООО Ромашка',
      registrationToken: 'one-time-registration-token',
      loginReservationToken: 'login-reservation-token-abcdefghijklmnopqrstuvwxyz',
    });
    expect(new Headers(init.headers).has('Authorization')).toBe(false);
    expect(init.credentials).toBe('include');
    expect(useAuthStore.getState().accessToken).toBe('registered-access');
  });

  it('резервирует логин до ввода пароля', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          login: 'tm1234567',
          reservationToken: 'login-reservation-token-abcdefghijklmnopqrstuvwxyz',
          expiresAt: '2026-08-10T12:30:00Z',
        },
        201,
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(httpAuthApi.reserveRegistrationLogin()).resolves.toMatchObject({
      login: 'tm1234567',
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:8080/api/v1/auth/registration-logins');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).has('Authorization')).toBe(false);
  });

  it('входит только по логину через v2 API', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ accessToken: 'login-access', user: wireUser }));
    vi.stubGlobal('fetch', fetchMock);

    await httpAuthApi.login({ login: 'tm8901912', password: 'reliable-password' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:8080/api/v2/auth/login');
    expect(JSON.parse(String(init.body))).toEqual({
      login: 'tm8901912',
      password: 'reliable-password',
    });
    expect(new Headers(init.headers).has('Authorization')).toBe(false);
  });

  it('проверяет одноразовый переход из amoCRM без внутренней авторизации', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        email: 'owner@example.com',
        login: 'tm8901912',
        companyName: 'Ракурс',
        requiresPasswordSetup: true,
        expiresAt: '2026-08-10T12:10:00Z',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      httpAuthApi.validateAmoWidgetContinuation('amo-widget-session-token'),
    ).resolves.toMatchObject({
      email: 'owner@example.com',
      login: 'tm8901912',
      requiresPasswordSetup: true,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:8080/api/v1/public/amocrm/widget-sessions/validate');
    expect(JSON.parse(String(init.body))).toEqual({ sessionToken: 'amo-widget-session-token' });
    expect(new Headers(init.headers).has('Authorization')).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('завершает вход из amoCRM паролем и запоминает сессию', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ accessToken: 'amo-access', user: wireUser }));
    vi.stubGlobal('fetch', fetchMock);

    await httpAuthApi.completeAmoWidgetContinuation({
      sessionToken: 'amo-widget-session-token',
      password: 'reliable-password',
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:8080/api/v1/auth/amocrm/complete');
    expect(JSON.parse(String(init.body))).toEqual({
      sessionToken: 'amo-widget-session-token',
      password: 'reliable-password',
    });
    expect(new Headers(init.headers).has('Authorization')).toBe(false);
    expect(init.credentials).toBe('include');
    expect(useAuthStore.getState().accessToken).toBe('amo-access');
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
