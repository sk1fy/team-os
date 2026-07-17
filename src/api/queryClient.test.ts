import { describe, expect, it } from 'vitest';
import { ApiError } from './client';
import { shouldRetryQuery } from './queryClient';

describe('shouldRetryQuery', () => {
  it('не повторяет клиентские ошибки и 404', () => {
    expect(shouldRetryQuery(0, new ApiError('Не найдено', 404))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError('Неверный запрос', 400))).toBe(false);
  });

  it('повторяет временные ошибки не более двух раз', () => {
    expect(shouldRetryQuery(0, new ApiError('Ошибка', 500))).toBe(true);
    expect(shouldRetryQuery(1, new Error('Сеть'))).toBe(true);
    expect(shouldRetryQuery(2, new Error('Сеть'))).toBe(false);
  });
});
