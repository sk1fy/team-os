import type { ISODate } from '@/types';

/** Allowed external deadline window in whole days (24h each). */
export const EXTERNAL_DEADLINE_MIN_DAYS = 1;
export const EXTERNAL_DEADLINE_MAX_DAYS = 7;

export function isValidExternalDeadlineDays(days: number): boolean {
  return Number.isInteger(days) && days >= EXTERNAL_DEADLINE_MIN_DAYS && days <= EXTERNAL_DEADLINE_MAX_DAYS;
}

export function externalDeadlineOptions(): number[] {
  return Array.from(
    { length: EXTERNAL_DEADLINE_MAX_DAYS - EXTERNAL_DEADLINE_MIN_DAYS + 1 },
    (_, i) => EXTERNAL_DEADLINE_MIN_DAYS + i,
  );
}

/**
 * Remaining time until accessUntil. Returns null if no deadline.
 * Expired if remainingMs <= 0.
 */
export function deadlineRemaining(accessUntil?: ISODate, now = Date.now()): {
  remainingMs: number;
  expired: boolean;
  label: string;
} | null {
  if (!accessUntil) return null;
  const end = Date.parse(accessUntil);
  if (Number.isNaN(end)) return null;
  const remainingMs = end - now;
  const expired = remainingMs <= 0;
  if (expired) {
    return { remainingMs, expired: true, label: 'Срок истёк' };
  }
  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) {
    return {
      remainingMs,
      expired: false,
      label: hours > 0 ? `${days} д ${hours} ч` : `${days} д`,
    };
  }
  if (hours > 0) {
    return {
      remainingMs,
      expired: false,
      label: minutes > 0 ? `${hours} ч ${minutes} мин` : `${hours} ч`,
    };
  }
  return { remainingMs, expired: false, label: `${Math.max(minutes, 1)} мин` };
}
