import { describe, expect, it } from 'vitest';
import type { User } from '@/types';
import { canActivateEmployee, countActiveEmployees } from './employeeActivation';

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
  it('разрешает занять последнее доступное место', () => {
    const users = [
      employee('1', true),
      employee('2', true),
      employee('3', true),
      employee('4', true),
      employee('5', false),
    ];

    expect(canActivateEmployee(users, users[4], 5)).toBe(true);
  });

  it('запрещает активировать сотрудника сверх лимита', () => {
    const users = [
      employee('1', true),
      employee('2', true),
      employee('3', true),
      employee('4', true),
      employee('5', true),
      employee('6', false),
    ];

    expect(countActiveEmployees(users)).toBe(5);
    expect(canActivateEmployee(users, users[5], 5)).toBe(false);
  });
});
