import { describe, expect, it } from 'vitest';
import type { User } from '@/types';
import {
  isCompanyCreatedWelcomeState,
  summarizeImportedUsers,
} from './companyCreatedWelcomeState';

function user(role: User['role'], status: User['status']): User {
  return { role, status, source: 'amo' } as User;
}

describe('companyCreatedWelcome', () => {
  it('показывает приветствие только для явного route state', () => {
    expect(isCompanyCreatedWelcomeState({ showCompanyCreatedWelcome: true })).toBe(true);
    expect(isCompanyCreatedWelcomeState({ showCompanyCreatedWelcome: false })).toBe(false);
    expect(isCompanyCreatedWelcomeState(null)).toBe(false);
  });

  it('считает активные роли и деактивированных пользователей отдельно', () => {
    expect(
      summarizeImportedUsers([
        user('owner', 'active'),
        user('admin', 'active'),
        user('admin', 'deactivated'),
        user('employee', 'active'),
        user('employee', 'invited'),
        user('employee', 'deactivated'),
        { ...user('admin', 'active'), source: 'local' },
      ]),
    ).toEqual({
      total: 6,
      owners: 1,
      admins: 1,
      employees: 1,
      deactivated: 2,
    });
  });
});
