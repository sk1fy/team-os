import { describe, expect, it } from 'vitest';
import { formatPhoneInput, isValidEmail, isValidPhone } from './formValidation';

describe('isValidEmail', () => {
  it.each(['a', 'a@', 'a@b', 'a b@c.d'])('отклоняет %s', (value) => {
    expect(isValidEmail(value)).toBe(false);
  });

  it.each(['user@example.com', 'A@B.COM', 'почта@домен.рф'])('принимает %s', (value) => {
    expect(isValidEmail(value)).toBe(true);
  });
});

describe('isValidPhone', () => {
  it.each(['abcdef', '12345', '+7 (999) call-me'])('отклоняет %s', (value) => {
    expect(isValidPhone(value)).toBe(false);
  });

  it.each(['', '+7 (999) 000-00-00', '89990000000'])('принимает %s', (value) => {
    expect(isValidPhone(value)).toBe(true);
  });
});

describe('formatPhoneInput', () => {
  it.each([
    ['9', '+7 (9'],
    ['89990000000', '+7 (999) 000-00-00'],
    ['+7 (999) call 000-00-00', '+7 (999) 000-00-00'],
    ['+1 202 555 0100', '+12025550100'],
    ['буквы', ''],
  ])('форматирует %s', (value, expected) => {
    expect(formatPhoneInput(value)).toBe(expected);
  });
});
