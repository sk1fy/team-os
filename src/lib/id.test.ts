import { afterEach, describe, expect, it, vi } from 'vitest';
import { createId } from './id';

describe('createId', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('создаёт UUID без crypto.randomUUID в HTTP-контексте', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.forEach((_, index) => {
          bytes[index] = index;
        });
        return bytes;
      },
    });

    expect(createId()).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
  });
});
