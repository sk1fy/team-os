import { describe, expect, it, vi } from 'vitest';
import { PHONE_ERROR } from '@/lib/formValidation';
import { validateEmployeePhone } from './employeePhoneValidation';

describe('validateEmployeePhone', () => {
  it('возвращает ошибку и переводит фокус в невалидное поле', () => {
    const focus = vi.fn();

    expect(validateEmployeePhone('123abc', { focus })).toBe(PHONE_ERROR);
    expect(focus).toHaveBeenCalledOnce();
  });

  it('не меняет фокус при валидном или пустом необязательном телефоне', () => {
    const focus = vi.fn();

    expect(validateEmployeePhone('+7 (999) 000-00-00', { focus })).toBeUndefined();
    expect(validateEmployeePhone('', { focus })).toBeUndefined();
    expect(focus).not.toHaveBeenCalled();
  });
});
