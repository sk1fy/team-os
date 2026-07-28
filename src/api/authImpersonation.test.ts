import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '@/api';
import * as db from './fixtures';
import { httpAuthApi } from './http';
import { useAuthStore } from '@/stores/auth';

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
  });
});

afterEach(() => {
  db.setCurrentUserId('user-1');
  db.employeeAccess.delete('user-8');
  db.employeePasswords.delete('user-8');
  const partner = db.users.find((user) => user.id === 'user-8');
  if (partner) partner.accessMode = 'none';
  db.persistEmployeeAccess();
  useAuthStore.setState({ accessToken: null, initialized: false });
  vi.unstubAllGlobals();
});

describe('mock owner impersonation', () => {
  it('входит под активным пользователем, не меняя его режим входа', async () => {
    db.setCurrentUserId('user-1');
    db.employeeAccess.set('user-8', { mode: 'password' });
    db.employeePasswords.set('user-8', 'ExistingPartnerPassword');
    const partner = db.users.find((user) => user.id === 'user-8');
    if (partner) partner.accessMode = 'password';

    const session = await authApi.impersonateUser('user-8');

    expect(session).toMatchObject({
      accessToken: 'mock-impersonation-token',
      user: { id: 'user-8', role: 'partner' },
    });
    expect(db.CURRENT_USER_ID).toBe('user-8');
    expect(db.employeeAccess.get('user-8')).toEqual({ mode: 'password' });
    expect(db.employeePasswords.get('user-8')).toBe('ExistingPartnerPassword');
  });

  it('запрещает impersonation администратору', async () => {
    db.setCurrentUserId('user-2');

    await expect(authApi.impersonateUser('user-8')).rejects.toMatchObject({ status: 403 });
    expect(db.CURRENT_USER_ID).toBe('user-2');
  });

  it('не разрешает вход под неактивным пользователем', async () => {
    db.setCurrentUserId('user-1');

    await expect(authApi.impersonateUser('user-9')).rejects.toMatchObject({ status: 400 });
    expect(db.CURRENT_USER_ID).toBe('user-1');
  });
});

describe('HTTP owner impersonation contract', () => {
  it('обменивает owner-сессию через отдельный endpoint с внутренней авторизацией', async () => {
    useAuthStore.getState().setAccessToken('owner-token');
    const target = db.users.find((user) => user.id === 'user-8');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          accessToken: 'impersonation-token',
          user: target,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(httpAuthApi.impersonateUser('user-8')).resolves.toMatchObject({
      accessToken: 'impersonation-token',
      user: { id: 'user-8' },
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/auth\/impersonate$/);
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ userId: 'user-8' }));
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer owner-token');
    expect(useAuthStore.getState().accessToken).toBe('impersonation-token');
  });
});
