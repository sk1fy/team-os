import { afterEach, describe, expect, it, vi } from 'vitest';
import { academyMutate } from './httpHelpers';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('academy mutation timeout', () => {
  it('aborts a stalled mutation instead of leaving the UI pending forever', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_input: string | URL | Request, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), {
              once: true,
            });
          }),
      ),
    );

    const request = academyMutate('/academy/course-version-lessons/lesson-1', 'PATCH', {
      title: 'Урок',
    });
    const assertion = expect(request).rejects.toMatchObject({
      status: 504,
      code: 'REQUEST_TIMEOUT',
    });

    await vi.advanceTimersByTimeAsync(20_000);
    await assertion;
  });
});
