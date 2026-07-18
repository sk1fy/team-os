import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { orgApi } from './index';
import { users } from './fixtures';
import { fullName } from '@/lib/labels';

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(1);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('сотрудник без фамилии', () => {
  it('создаёт локального сотрудника с пустой фамилией', async () => {
    const result = orgApi.createUser({
      firstName: 'Алексей',
      lastName: '',
      email: 'alexey.no-last-name@example.com',
      role: 'employee',
    });
    await vi.runAllTimersAsync();
    const created = await result;

    expect(created.lastName).toBe('');
    expect(fullName(created)).toBe('Алексей');
    const index = users.findIndex((user) => user.id === created.id);
    if (index >= 0) users.splice(index, 1);
  });

  it('отображает импортированного из amoCRM сотрудника без лишнего пробела', () => {
    expect(fullName({ firstName: 'Мария', lastName: '' })).toBe('Мария');
  });
});
