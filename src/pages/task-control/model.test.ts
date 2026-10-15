import { describe, expect, it } from 'vitest';
import { crmIds, readProof } from './model';
const uuid = '10000000-0000-4000-8000-000000000001';
const proof = (changes = {}) =>
  'test.' +
  btoa(
    JSON.stringify({
      purpose: 'link',
      accountId: '123',
      product: 'task-control',
      aud: 'teamos-task-control',
      requestId: uuid,
      installationId: uuid,
      integrationId: uuid,
      exp: Date.now() / 1000 + 60,
      ...changes,
    }),
  ).replace(/=/g, '') +
  '.signature';
describe('Task Control forms', () => {
  it('routes proof only to its account and purpose and rejects expired codes', () => {
    expect(readProof(proof(), 'link', '123').requestId).toBe(uuid);
    expect(() => readProof(proof(), 'mode', '123')).toThrow();
    expect(() => readProof(proof(), 'link', '456')).toThrow();
    expect(() => readProof(proof({ exp: 1 }), 'link', '123')).toThrow();
    expect(() => readProof(proof({ product: 'lead-distribution' }), 'link', '123')).toThrow();
  });
  it('preserves safe CRM decimal IDs and rejects coercions and unsafe IDs', () => {
    expect(crmIds('1, 2;2 3')).toEqual(['1', '2', '3']);
    for (const value of ['0', '-1', '1.5', '2e3', '9007199254740992', 'abc'])
      expect(() => crmIds(value)).toThrow();
  });
});
