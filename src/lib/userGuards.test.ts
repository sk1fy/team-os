import { describe, expect, it } from 'vitest';
import type { User } from '@/types';
import { validateUserUpdate } from './userGuards';

const owner: User = {
  id: 'owner-1',
  email: 'owner@company.ru',
  firstName: 'Owner',
  lastName: 'User',
  role: 'owner',
  status: 'active',
  positionIds: [],
  createdAt: '2026-01-01T00:00:00.000Z',
};

const admin: User = {
  ...owner,
  id: 'admin-1',
  role: 'admin',
};

describe('validateUserUpdate', () => {
  it('запрещает понижение роли и деактивацию владельца', () => {
    expect(
      validateUserUpdate(owner, { role: 'admin' }, { ownerId: 'owner-1', currentUserId: 'admin-1' }),
    ).toBe('Нельзя изменить роль владельца компании');

    expect(
      validateUserUpdate(
        owner,
        { status: 'deactivated' },
        { ownerId: 'owner-1', currentUserId: 'owner-1' },
      ),
    ).toBe('Нельзя деактивировать владельца компании');
  });

  it('запрещает самопонижение роли и самодеактивацию', () => {
    expect(
      validateUserUpdate(admin, { role: 'employee' }, { ownerId: 'owner-1', currentUserId: 'admin-1' }),
    ).toBe('Нельзя понизить собственную роль');

    expect(
      validateUserUpdate(
        admin,
        { status: 'deactivated' },
        { ownerId: 'owner-1', currentUserId: 'admin-1' },
      ),
    ).toBe('Нельзя деактивировать собственный аккаунт');
  });

  it('разрешает безопасные изменения', () => {
    expect(
      validateUserUpdate(admin, { role: 'admin' }, { ownerId: 'owner-1', currentUserId: 'owner-1' }),
    ).toBeNull();
  });
});