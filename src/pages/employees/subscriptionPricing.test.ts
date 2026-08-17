import { describe, expect, it } from 'vitest';
import {
  additionalUsersPrice,
  basicRenewalPrice,
  subscriptionDaysRemaining,
} from './subscriptionPricing';

describe('subscription pricing', () => {
  it('считает докупку по оставшимся дням, ставке 16 рублей и количеству пользователей', () => {
    const today = new Date('2026-09-14T12:00:00Z');

    expect(subscriptionDaysRemaining('2027-07-14T00:00:00Z', today)).toBe(303);
    expect(additionalUsersPrice('2027-07-14T00:00:00Z', 2, today)).toBe(9_696);
  });

  it('не начисляет стоимость после окончания подписки', () => {
    expect(additionalUsersPrice('2026-01-01T00:00:00Z', 3, new Date('2026-01-02T00:00:00Z'))).toBe(
      0,
    );
  });

  it('считает годовое продление отдельно от докупки', () => {
    expect(basicRenewalPrice(5)).toBe(3_000);
    expect(basicRenewalPrice(6)).toBe(9_000);
  });
});
