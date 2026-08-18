import { describe, expect, it } from 'vitest';
import { ApiError } from '@/api/client';
import {
  amoSessionAccessErrorView,
  isValidAmoAccountId,
  safeAmoSessionRedirect,
} from './amoSessionAccess';

describe('amoCRM session access', () => {
  it('принимает только положительный числовой Account ID', () => {
    expect(isValidAmoAccountId('31355990')).toBe(true);
    expect(isValidAmoAccountId('0')).toBe(false);
    expect(isValidAmoAccountId('313a')).toBe(false);
    expect(isValidAmoAccountId('')).toBe(false);
  });

  it('разрешает только same-origin относительный redirect', () => {
    expect(safeAmoSessionRedirect('/schedule')).toBe('/schedule');
    expect(safeAmoSessionRedirect('/schedule?week=next#today')).toBe('/schedule?week=next#today');
    expect(safeAmoSessionRedirect('https://attacker.example')).toBeUndefined();
    expect(safeAmoSessionRedirect('//attacker.example/path')).toBeUndefined();
    expect(safeAmoSessionRedirect('/\\attacker.example/path')).toBeUndefined();
  });

  it('показывает понятные ошибки для отказа и отсутствующей компании', () => {
    expect(amoSessionAccessErrorView(new ApiError('forbidden', 403))).toMatchObject({
      title: 'Недостаточно прав',
      action: 'none',
    });
    expect(amoSessionAccessErrorView(new ApiError('not found', 404))).toMatchObject({
      title: 'Компания не найдена',
      action: 'none',
    });
    expect(amoSessionAccessErrorView(new ApiError('Конфликт привязки', 409))).toMatchObject({
      title: 'Не удалось подтвердить доступ',
      description: 'Конфликт привязки',
      action: 'none',
    });
    expect(amoSessionAccessErrorView(new ApiError('Компания заморожена', 423))).toMatchObject({
      title: 'Доступ временно заблокирован',
      description: 'Компания заморожена',
      action: 'none',
    });
  });
});
