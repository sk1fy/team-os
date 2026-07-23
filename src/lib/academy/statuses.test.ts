import { describe, expect, it } from 'vitest';
import {
  deadlineRemaining,
  isValidExternalDeadlineDays,
  externalDeadlineOptions,
  sortEnrollmentsForMyLearning,
  pickContinueEnrollment,
  resolveEnrollmentIdForLegacyCourse,
  lifecycleStatusLabel,
  distributionStatusLabel,
} from './index';
import type { EnrollmentSummary } from '@/types/academy';

describe('deadline', () => {
  it('принимает только 1–7 дней', () => {
    expect(isValidExternalDeadlineDays(1)).toBe(true);
    expect(isValidExternalDeadlineDays(7)).toBe(true);
    expect(isValidExternalDeadlineDays(0)).toBe(false);
    expect(isValidExternalDeadlineDays(8)).toBe(false);
    expect(isValidExternalDeadlineDays(1.5)).toBe(false);
    expect(externalDeadlineOptions()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('считает remaining и expired', () => {
    const now = Date.parse('2026-07-22T12:00:00.000Z');
    const future = deadlineRemaining('2026-07-23T12:00:00.000Z', now);
    expect(future?.expired).toBe(false);
    expect(future?.label).toContain('д');

    const past = deadlineRemaining('2026-07-21T12:00:00.000Z', now);
    expect(past?.expired).toBe(true);
    expect(past?.label).toBe('Срок истёк');

    expect(deadlineRemaining(undefined, now)).toBeNull();
  });
});

describe('statuses', () => {
  it('маппит lifecycle и distribution с текстом, не только цветом', () => {
    expect(lifecycleStatusLabel('active').label).toBe('Активен');
    expect(lifecycleStatusLabel('archived').label).toBe('В архиве');
    expect(distributionStatusLabel('paused').label).toContain('приостановлено');
    expect(distributionStatusLabel('blocked').label).toBe('Заблокирован');
  });
});

describe('course ordering', () => {
  const items: EnrollmentSummary[] = [
    {
      id: 'e3',
      courseId: 'c3',
      courseVersionId: 'v3',
      courseTitle: 'Done',
      learnerType: 'user',
      progressStatus: 'completed',
      accessStatus: 'closed',
      percent: 100,
      completedLessons: 5,
      totalLessons: 5,
    },
    {
      id: 'e1',
      courseId: 'c1',
      courseVersionId: 'v1',
      courseTitle: 'Active',
      learnerType: 'user',
      progressStatus: 'in_progress',
      accessStatus: 'active',
      percent: 40,
      completedLessons: 2,
      totalLessons: 5,
      dueDate: '2026-07-25T00:00:00.000Z',
    },
    {
      id: 'e2',
      courseId: 'c2',
      courseVersionId: 'v2',
      courseTitle: 'New',
      learnerType: 'user',
      progressStatus: 'not_started',
      accessStatus: 'ready',
      percent: 0,
      completedLessons: 0,
      totalLessons: 3,
    },
  ];

  it('сортирует continue-first', () => {
    expect(sortEnrollmentsForMyLearning(items).map((i) => i.id)).toEqual(['e1', 'e2', 'e3']);
    expect(pickContinueEnrollment(items)?.id).toBe('e1');
  });
});

describe('legacy resolvers', () => {
  it('выбирает in_progress enrollment для courseId', () => {
    const enrollments: EnrollmentSummary[] = [
      {
        id: 'old',
        courseId: 'c1',
        courseVersionId: 'v1',
        courseTitle: 'C',
        learnerType: 'user',
        progressStatus: 'completed',
        accessStatus: 'closed',
        percent: 100,
        completedLessons: 1,
        totalLessons: 1,
      },
      {
        id: 'active',
        courseId: 'c1',
        courseVersionId: 'v2',
        courseTitle: 'C',
        learnerType: 'user',
        progressStatus: 'in_progress',
        accessStatus: 'active',
        percent: 10,
        completedLessons: 0,
        totalLessons: 1,
      },
    ];
    expect(resolveEnrollmentIdForLegacyCourse('c1', enrollments)).toBe('active');
    expect(resolveEnrollmentIdForLegacyCourse('missing', enrollments)).toBeNull();
  });
});
