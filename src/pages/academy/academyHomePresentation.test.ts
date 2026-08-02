import { describe, expect, it } from 'vitest';
import type {
  EnrollmentAccessStatus,
  EnrollmentProgressStatus,
  EnrollmentSummary,
} from '@/types/academy';
import { enrollmentCardPresentation } from './academyHomePresentation';

function enrollment(
  progressStatus: EnrollmentProgressStatus,
  accessStatus: EnrollmentAccessStatus,
): EnrollmentSummary {
  return {
    id: `${progressStatus}-${accessStatus}`,
    courseId: 'course-1',
    courseVersionId: 'version-1',
    courseTitle: 'Тестовый курс',
    learnerType: 'user',
    progressStatus,
    accessStatus,
    percent: progressStatus === 'completed' ? 100 : 0,
    completedLessons: progressStatus === 'completed' ? 1 : 0,
    totalLessons: 1,
  };
}

describe('academy home enrollment cards', () => {
  it('показывает корректные CTA для доступных прохождений', () => {
    expect(enrollmentCardPresentation(enrollment('not_started', 'ready'))).toEqual({
      kind: 'link',
      ctaLabel: 'Начать обучение',
    });
    expect(enrollmentCardPresentation(enrollment('in_progress', 'active'))).toEqual({
      kind: 'link',
      ctaLabel: 'Продолжить',
    });
    expect(enrollmentCardPresentation(enrollment('completed', 'active'))).toEqual({
      kind: 'link',
      ctaLabel: 'Просмотреть',
    });
  });

  it.each<EnrollmentAccessStatus>([
    'expired',
    'frozen',
    'suspended',
    'revoked',
    'closed',
  ])('не предлагает переход к материалам для статуса %s', (accessStatus) => {
    const presentation = enrollmentCardPresentation(enrollment('in_progress', accessStatus));

    expect(presentation.kind).toBe('restricted');
    if (presentation.kind === 'restricted') {
      expect(presentation.access.label).not.toBe('Активен');
      expect(presentation.restrictionLabel).toBe('Доступ ограничен');
    }
  });
});
