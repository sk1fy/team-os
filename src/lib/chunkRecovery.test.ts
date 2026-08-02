import { describe, expect, it, vi } from 'vitest';
import { installChunkRecovery, recoverFromStaleChunk } from './chunkRecovery';

function recoveryTarget(lastReload?: string) {
  const values = new Map<string, string>();
  if (lastReload) values.set('teamos:last-stale-chunk-reload', lastReload);
  return {
    location: { reload: vi.fn() },
    sessionStorage: {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    },
  };
}

describe('stale chunk recovery', () => {
  it('reloads once when Vite reports a removed lazy chunk', () => {
    const target = recoveryTarget();
    const event = new Event('vite:preloadError', { cancelable: true });

    expect(recoverFromStaleChunk(event, target as never, 100_000)).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    expect(target.location.reload).toHaveBeenCalledOnce();
  });

  it('does not enter a reload loop for the same stale deployment', () => {
    const target = recoveryTarget('90000');
    const event = new Event('vite:preloadError', { cancelable: true });

    expect(recoverFromStaleChunk(event, target as never, 100_000)).toBe(false);
    expect(target.location.reload).not.toHaveBeenCalled();
  });

  it('registers and removes the Vite listener', () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const dispose = installChunkRecovery({
      ...recoveryTarget(),
      addEventListener,
      removeEventListener,
    } as never);

    expect(addEventListener).toHaveBeenCalledWith('vite:preloadError', expect.any(Function));
    dispose();
    expect(removeEventListener).toHaveBeenCalledWith(
      'vite:preloadError',
      addEventListener.mock.calls[0]?.[1],
    );
  });
});
