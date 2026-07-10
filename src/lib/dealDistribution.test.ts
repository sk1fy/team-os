import { describe, expect, it } from 'vitest';
import type { DealDistributionGroup, DistributionEvent } from '@/types';
import { pickDistributionMember } from './dealDistribution';

const group: DealDistributionGroup = {
  id: 'group-1',
  name: 'Продажи',
  active: true,
  algorithm: 'round_robin',
  memberIds: ['user-1', 'user-2', 'user-3'],
  disabledMemberIds: [],
  source: 'Сайт',
  dealLimit: 10,
  unclaimedMinutes: 15,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const event = (
  id: string,
  userId: string,
  status: DistributionEvent['status'] = 'accepted',
): DistributionEvent => ({
  id,
  groupId: group.id,
  dealNumber: Number(id),
  userId,
  status,
  createdAt: `2026-01-01T00:0${id}:00.000Z`,
});

describe('pickDistributionMember', () => {
  it('выбирает следующего участника по кругу', () => {
    expect(pickDistributionMember(group, [event('1', 'user-1')])).toBe('user-2');
    expect(pickDistributionMember(group, [event('1', 'user-3')])).toBe('user-1');
  });

  it('выбирает сотрудника с наименьшей нагрузкой', () => {
    const leastLoaded = { ...group, algorithm: 'least_loaded' as const };
    expect(pickDistributionMember(leastLoaded, [event('1', 'user-1'), event('2', 'user-2')])).toBe(
      'user-3',
    );
  });

  it('при приоритетном алгоритме выбирает первого участника', () => {
    expect(pickDistributionMember({ ...group, algorithm: 'priority' }, [])).toBe('user-1');
  });

  it('пропускает временно выключенных участников', () => {
    expect(
      pickDistributionMember({ ...group, disabledMemberIds: ['user-2'] }, [event('1', 'user-1')]),
    ).toBe('user-3');
  });
});
