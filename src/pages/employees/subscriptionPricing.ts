const DAY_MS = 86_400_000;

export const BASIC_INCLUDED_USERS = 5;
export const BASIC_YEAR_PRICE = 3_000;
export const BASIC_EXTRA_USER_YEAR_PRICE = 6_000;
export const ADDITIONAL_USER_DAY_PRICE = 16;

function utcDay(value: Date | string): number {
  const date = typeof value === 'string' ? new Date(value) : value;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function subscriptionDaysRemaining(paidUntil: string, today = new Date()): number {
  return Math.max(0, Math.ceil((utcDay(paidUntil) - utcDay(today)) / DAY_MS));
}

export function additionalUsersPrice(
  paidUntil: string,
  quantity: number,
  today = new Date(),
): number {
  const normalizedQuantity = Math.max(0, Math.floor(quantity));
  return (
    subscriptionDaysRemaining(paidUntil, today) * ADDITIONAL_USER_DAY_PRICE * normalizedQuantity
  );
}

export function basicRenewalPrice(userCount: number): number {
  const normalizedCount = Math.max(BASIC_INCLUDED_USERS, Math.floor(userCount));
  return BASIC_YEAR_PRICE + (normalizedCount - BASIC_INCLUDED_USERS) * BASIC_EXTRA_USER_YEAR_PRICE;
}
