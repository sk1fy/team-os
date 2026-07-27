import { describe, expect, it } from 'vitest';
import { resolveApiUrl } from './config';

describe('resolveApiUrl', () => {
  it('uses the same-origin API path in production by default', () => {
    expect(resolveApiUrl(undefined, { isProduction: true, pageProtocol: 'https:' })).toBe(
      '/api/v1',
    );
  });

  it('prevents mixed content when an old HTTP API URL reaches an HTTPS build', () => {
    expect(
      resolveApiUrl('http://31.76.42.128:8080/api/v1/', {
        isProduction: true,
        pageProtocol: 'https:',
      }),
    ).toBe('/api/v1');
  });

  it('keeps an explicit HTTPS API URL', () => {
    expect(
      resolveApiUrl('https://api.example.ru/api/v1/', {
        isProduction: true,
        pageProtocol: 'https:',
      }),
    ).toBe('https://api.example.ru/api/v1');
  });

  it('keeps the local HTTP API URL during development', () => {
    expect(
      resolveApiUrl(undefined, {
        isProduction: false,
        pageProtocol: 'http:',
      }),
    ).toBe('http://localhost:8080/api/v1');
  });
});
