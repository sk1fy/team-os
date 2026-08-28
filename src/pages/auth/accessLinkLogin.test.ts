import { describe, expect, it, vi } from 'vitest';
import { createAccessLinkLoginDeduplicator } from './accessLinkLogin';

describe('createAccessLinkLoginDeduplicator', () => {
  it('объединяет два одновременных обмена одного access-link в StrictMode', async () => {
    let resolveLogin: ((session: { entryContext: string }) => void) | undefined;
    const login = vi.fn(
      () =>
        new Promise<{ entryContext: string }>((resolve) => {
          resolveLogin = resolve;
        }),
    );
    const loginOnce = createAccessLinkLoginDeduplicator(login);

    const first = loginOnce('token');
    const second = loginOnce('token');

    expect(second).toBe(first);
    expect(login).toHaveBeenCalledTimes(1);

    resolveLogin?.({ entryContext: 'company_created' });
    await first;
    await Promise.resolve();

    void loginOnce('token');
    expect(login).toHaveBeenCalledTimes(2);
  });
});
