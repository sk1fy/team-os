import { PHONE_ERROR, isValidPhone } from '@/lib/formValidation';

export function validateEmployeePhone(
  phone: string,
  input: Pick<HTMLInputElement, 'focus'> | null,
) {
  if (isValidPhone(phone)) return undefined;
  input?.focus();
  return PHONE_ERROR;
}
