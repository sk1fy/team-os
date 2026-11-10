import { httpRequest, jsonBody, establishSession, type AuthSession } from '@/api/client';
import type { components } from '@/api/generated/teamos';
import type { User } from '@/types';

type CapturedEntry = { kind: 'code'; code: string } | { kind: 'invalid' };

export function parseCompanyEntryFragment(fragment: string): CapturedEntry {
  const values = new URLSearchParams(fragment.replace(/^#/, ''));
  const code = values.get('code');
  if (values.size !== 1 || !code || !/^[a-zA-Z0-9_-]{32,256}$/.test(code))
    return { kind: 'invalid' };
  return { kind: 'code', code };
}

export function exchangeCompanyEntry(code: string): Promise<AuthSession<User>> {
  return establishSession(() =>
    httpRequest<AuthSession<User>>(
      '/auth/amocrm/entry-exchange',
      {
        method: 'POST',
        body: jsonBody({ code } satisfies components['schemas']['AmoEntryExchangeInput']),
      },
      { authMode: 'none' },
    ),
  );
}

export function createCompanyEntryExchange<T>(exchange: () => Promise<T>): () => Promise<T> {
  let request: Promise<T> | undefined;
  return () => (request ??= Promise.resolve().then(exchange));
}
