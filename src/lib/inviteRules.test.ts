import { describe, expect, it } from 'vitest';
import type { User } from '@/types';
import { validateInviteEmail } from './inviteRules';

const users: User[] = [
  {
    id: 'u-1',
    email: 'active@company.ru',
    firstName: 'Active',
    lastName: 'User',
    role: 'employee',
    status: 'active',
    positionIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'u-2',
    email: 'old@company.ru',
    firstName: 'Old',
    lastName: 'User',
    role: 'employee',
    status: 'deactivated',
    positionIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('validateInviteEmail', () => {
  it('блокирует повторное приглашение активного email', () => {
    expect(validateInviteEmail('active@company.ru', users)).toBe(
      'Сотрудник с таким email уже есть в компании',
    );
  });

  it('разрешает повтор для деактивированного сотрудника', () => {
    expect(validateInviteEmail('old@company.ru', users)).toBeNull();
  });
});