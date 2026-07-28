const emailPattern = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/u;
const phoneCharactersPattern = /^\+?[\d\s()-]+$/u;

export const EMAIL_ERROR = 'Введите корректный email, например name@company.ru';
export const PHONE_ERROR = 'Введите телефон в формате +7 999 000-00-00';

export function isValidEmail(value: string): boolean {
  const email = value.trim();
  return email.length <= 254 && emailPattern.test(email);
}

export function isValidPhone(value: string): boolean {
  const phone = value.trim();
  if (!phone) return true;
  if (!phoneCharactersPattern.test(phone)) return false;
  const digits = phone.replace(/\D/gu, '');
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * Очищает ввод от букв и форматирует российский номер по мере набора.
 * Международные номера с другим кодом сохраняются в безопасном виде `+<digits>`.
 */
export function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/gu, '');
  if (!digits) return '';

  const firstDigit = digits[0];
  if (firstDigit !== '7' && firstDigit !== '8' && firstDigit !== '9') {
    return `+${digits.slice(0, 15)}`;
  }

  const normalized =
    firstDigit === '9' ? `7${digits}` : firstDigit === '8' ? `7${digits.slice(1)}` : digits;
  const national = normalized.slice(1, 11);
  let formatted = '+7';

  if (national.length > 0) formatted += ` (${national.slice(0, 3)}`;
  if (national.length >= 3) formatted += ')';
  if (national.length > 3) formatted += ` ${national.slice(3, 6)}`;
  if (national.length > 6) formatted += `-${national.slice(6, 8)}`;
  if (national.length > 8) formatted += `-${national.slice(8, 10)}`;

  return formatted;
}
