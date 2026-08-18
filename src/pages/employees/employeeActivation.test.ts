import { describe, expect, it } from 'vitest';
import type { User } from '@/types';
import { canActivateEmployee, countActiveEmployees } from './employeeActivation';
import { BASIC_INCLUDED_USERS } from './subscriptionPricing';

function employee(id: string, active: boolean): User {
  return {
    id,
    email: `${id}@company.ru`,
    firstName: id,
    lastName: '',
    role: 'employee',
    status: 'active',
    positionIds: [],
    showInSchedule: active,
    createdAt: '2026-01-01T00:00:00Z',
  };
}

describe('employee activation limit', () => {
  it('разрешает активировать владельца и администратора', () => {
    const owner = { ...employee('owner', false), role: 'owner' as const };
    const admin = { ...employee('admin', false), role: 'admin' as const };

    expect(canActivateEmployee([owner, admin], owner, BASIC_INCLUDED_USERS)).toBe(true);
    expect(canActivateEmployee([owner, admin], admin, BASIC_INCLUDED_USERS)).toBe(true);
  });

  it('разрешает занять последнее доступное место', () => {
    const users = Array.from({ length: BASIC_INCLUDED_USERS }, (_, index) =>
      employee(String(index + 1), index < BASIC_INCLUDED_USERS - 1),
    );

    expect(canActivateEmployee(users, users[BASIC_INCLUDED_USERS - 1], BASIC_INCLUDED_USERS)).toBe(
      true,
    );
  });

  it('запрещает активировать сотрудника сверх лимита', () => {
    const users = [
      ...Array.from({ length: BASIC_INCLUDED_USERS }, (_, index) =>
        employee(String(index + 1), true),
      ),
      employee(String(BASIC_INCLUDED_USERS + 1), false),
    ];

    expect(countActiveEmployees(users)).toBe(BASIC_INCLUDED_USERS);
    expect(
      canActivateEmployee(users, users[BASIC_INCLUDED_USERS], BASIC_INCLUDED_USERS),
    ).toBe(false);
  });
});
