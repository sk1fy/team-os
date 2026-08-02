import { enrollmentAccessLabel, isEnrollmentAvailable } from '@/lib/academy';
import type { StatusPresentation } from '@/lib/academy';
import type { EnrollmentSummary } from '@/types/academy';

export type EnrollmentCardPresentation =
  | {
      kind: 'link';
      ctaLabel: 'Начать обучение' | 'Продолжить' | 'Просмотреть';
    }
  | {
      kind: 'restricted';
      access: StatusPresentation;
      restrictionLabel: 'Доступ ограничен';
    };

export function enrollmentCardPresentation(
  enrollment: EnrollmentSummary,
): EnrollmentCardPresentation {
  if (!isEnrollmentAvailable(enrollment.accessStatus)) {
    return {
      kind: 'restricted',
      access: enrollmentAccessLabel(enrollment.accessStatus),
      restrictionLabel: 'Доступ ограничен',
    };
  }

  if (enrollment.progressStatus === 'not_started') {
    return { kind: 'link', ctaLabel: 'Начать обучение' };
  }

  if (enrollment.progressStatus === 'in_progress') {
    return { kind: 'link', ctaLabel: 'Продолжить' };
  }

  return { kind: 'link', ctaLabel: 'Просмотреть' };
}
