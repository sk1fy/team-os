import { describe, expect, it, vi } from 'vitest';
import {
  createCompanyEntryExchange,
  exchangeCompanyEntry,
  parseCompanyEntryFragment,
} from './amoCompanyEntry';

vi.mock('@/api/client', () => ({
  establishSession: (request: () => Promise<unknown>) => request(),
  httpRequest: vi.fn(async () => ({ user: { id: 'own-admin' }, accessToken: 'session' })),
  jsonBody: JSON.stringify,
}));

describe('company entry handoff', () => {
  it('accepts only one opaque fragment code', () => {
    const code = 'a'.repeat(43);
    expect(parseCompanyEntryFragment(`#code=${code}`)).toEqual({ kind: 'code', code });
    for (const hash of [
      '',
      '#code=',
      '#code=short',
      `#code=${code}&code=${code}`,
      `#code=${code}&companyId=other`,
      '#token=permanent',
    ]) {
      expect(parseCompanyEntryFragment(hash)).toEqual({ kind: 'invalid' });
    }
  });

  it('performs exactly one exchange across StrictMode subscriptions and completion', async () => {
    const exchange = vi.fn(async () => ({ userId: 'own-admin' }));
    const once = createCompanyEntryExchange(exchange);
    const first = once();
    expect(once()).toBe(first);
    await expect(first).resolves.toEqual({ userId: 'own-admin' });
    expect(once()).toBe(first);
    expect(exchange).toHaveBeenCalledOnce();
  });

  it('does not replay a failed one-use code', async () => {
    const exchange = vi.fn(async () => {
      throw new Error('consumed');
    });
    const once = createCompanyEntryExchange(exchange);
    await expect(once()).rejects.toThrow('consumed');
    await expect(once()).rejects.toThrow('consumed');
    expect(exchange).toHaveBeenCalledOnce();
  });

  it('uses the public exchange with only the code and no internal bearer refresh', async () => {
    const { httpRequest } = await import('@/api/client');
    await exchangeCompanyEntry('a'.repeat(43));
    expect(httpRequest).toHaveBeenCalledWith(
      '/auth/amocrm/entry-exchange',
      {
        method: 'POST',
        body: JSON.stringify({ code: 'a'.repeat(43) }),
      },
      { authMode: 'none' },
    );
  });
});
