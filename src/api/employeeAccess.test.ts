import { afterEach, describe, expect, it } from 'vitest';
import { orgApi } from '@/api';
import * as db from './fixtures';

afterEach(() => {
  db.setCurrentUserId('user-1');
  db.employeeAccess.delete('user-3');
  db.employeePasswords.delete('user-3');
  const employee = db.users.find((user) => user.id === 'user-3');
  if (employee) employee.accessMode = 'none';
  db.persistEmployeeAccess();
});

describe('mock employee access targets', () => {
  it('позволяет администратору выдавать и отзывать доступ сотрудника', async () => {
    db.setCurrentUserId('user-2');

    await expect(
      orgApi.setUserPasswordAccess('user-3', { password: 'AdminPassword123' }),
    ).resolves.toEqual({ password: 'AdminPassword123' });
    await expect(orgApi.setUserLinkAccess('user-3')).resolves.toMatchObject({
      token: expect.any(String),
      createdAt: expect.any(String),
    });
    await expect(orgApi.revokeUserAccess('user-3')).resolves.toBeUndefined();
  });

  it('не позволяет отозвать доступ владельца', async () => {
    await expect(orgApi.revokeUserAccess('user-1')).rejects.toMatchObject({ status: 400 });
  });

  it('не позволяет выдать доступ неактивному пользователю', async () => {
    await expect(orgApi.setUserLinkAccess('user-7')).rejects.toMatchObject({ status: 400 });
    await expect(orgApi.setUserPasswordAccess('user-9', {})).rejects.toMatchObject({ status: 400 });
  });
});
