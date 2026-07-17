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
