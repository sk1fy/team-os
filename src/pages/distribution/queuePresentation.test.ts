import { describe, expect, it } from 'vitest';
import {
  accountDateTime,
  isQueueConfirmed,
  isQueueFinished,
  queueDuration,
} from './queuePresentation';
describe('account time in queue filters', () => {
  it('keeps date boundary in the CRM account zone instead of the browser zone', () => {
    expect(accountDateTime('2026-10-08T00:15', 'Europe/Moscow')).toBe('2026-10-07T21:15:00.000Z');
    expect(accountDateTime('2026-10-07T23:00', 'America/New_York')).toBe(
      '2026-10-08T03:00:00.000Z',
    );
  });
  it('rejects nonexistent DST local time and handles both sides of the change', () => {
    expect(() => accountDateTime('2026-03-08T02:30', 'America/New_York')).toThrow('отсутствует');
    expect(accountDateTime('2026-03-08T01:30', 'America/New_York')).toBe(
      '2026-03-08T06:30:00.000Z',
    );
    expect(accountDateTime('2026-03-08T03:30', 'America/New_York')).toBe(
      '2026-03-08T07:30:00.000Z',
    );
  });
});
it('does not present a dispatch or uncertain outcome as a confirmed assignment', () => {
  for (const state of ['waiting', 'dispatching', 'confirming', 'uncertain']) {
    expect(isQueueConfirmed(state)).toBe(false);
    expect(isQueueFinished(state)).toBe(false);
  }
  expect(isQueueConfirmed('confirmed')).toBe(true);
  expect(isQueueFinished('cancelled')).toBe(true);
  expect(isQueueConfirmed('cancelled')).toBe(false);
});
it('keeps elapsed wait readable over the three-day period', () => {
  expect(queueDuration('2026-10-03T07:00:00Z', '2026-10-06T07:00:00Z')).toBe('3 д. 0 ч.');
  expect(queueDuration('2026-10-03T07:00:00Z', '2026-10-03T08:15:00Z')).toBe('1 ч. 15 мин.');
});
