import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { orgApi } from './index';
import { schedules, users } from './fixtures';
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
    expect(created.showInSchedule).toBe(false);
    expect(schedules.find((schedule) => schedule.userId === created.id)?.template).toEqual({
      type: 'week',
      days: [0, 1, 2, 3, 4],
      start: '09:00',
      end: '18:00',
    });
    const index = users.findIndex((user) => user.id === created.id);
    if (index >= 0) users.splice(index, 1);
    const scheduleIndex = schedules.findIndex((schedule) => schedule.userId === created.id);
    if (scheduleIndex >= 0) schedules.splice(scheduleIndex, 1);
  });

  it('отображает импортированного из amoCRM сотрудника без лишнего пробела', () => {
    expect(fullName({ firstName: 'Мария', lastName: '' })).toBe('Мария');
  });
});
