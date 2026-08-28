import { describe, expect, it } from 'vitest';
import type { User } from '@/types';
import { hasAmoWidgetAccess } from './employeeAmoWidgetAccess';

function user(overrides: Partial<User>): User {
  return {
    source: 'amo',
    role: 'employee',
    status: 'active',
    ...overrides,
  } as User;
}

describe('hasAmoWidgetAccess', () => {
  it('включает вход через виджет активному администратору amoCRM', () => {
    expect(hasAmoWidgetAccess(user({ role: 'admin' }))).toBe(true);
  });

  it('не включает вход через виджет обычному или деактивированному сотруднику', () => {
    expect(hasAmoWidgetAccess(user({ role: 'employee' }))).toBe(false);
    expect(hasAmoWidgetAccess(user({ role: 'admin', status: 'deactivated' }))).toBe(false);
  });

  it('не смешивает вход локального администратора с интеграцией amoCRM', () => {
    expect(hasAmoWidgetAccess(user({ role: 'admin', source: 'local' }))).toBe(false);
  });
});
