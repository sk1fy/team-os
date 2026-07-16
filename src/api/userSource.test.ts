import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { orgApi } from './index';
import { users } from './fixtures';

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(1);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('источник сотрудников', () => {
  it('задан для всех демонстрационных пользователей', () => {
    expect(Object.fromEntries(users.map((user) => [user.id, user.source]))).toEqual({
      'user-1': 'local',
      'user-2': 'local',
      'user-3': 'amo',
      'user-4': 'amo',
      'user-5': 'local',
      'user-6': 'amo',
      'user-7': 'local',
      'user-8': 'local',
      'user-9': 'amo',
    });
  });

  it('не позволяет удалить импортированного сотрудника', async () => {
    const result = expect(orgApi.deleteUser('user-3')).rejects.toMatchObject({
      status: 400,
      message:
        'Нельзя удалить пользователя, импортированного из amoCRM. Сначала отключите интеграцию.',
    });
    await vi.runAllTimersAsync();
    await result;
    expect(users.some((user) => user.id === 'user-3')).toBe(true);
  });

  it('удаляет локального сотрудника', async () => {
    const index = users.findIndex((user) => user.id === 'user-8');
    const user = structuredClone(users[index]!);
    const result = expect(orgApi.deleteUser('user-8')).resolves.toBeUndefined();
    await vi.runAllTimersAsync();
    await result;
    expect(users.some((item) => item.id === 'user-8')).toBe(false);
    users.splice(index, 0, user);
  });
});
