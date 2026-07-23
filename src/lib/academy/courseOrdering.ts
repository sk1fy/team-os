import type { EnrollmentSummary } from '@/types/academy';

/** Sort enrollments: continue-first (in progress / overdue by due date), then not started, then completed. */
export function sortEnrollmentsForMyLearning(items: EnrollmentSummary[]): EnrollmentSummary[] {
  const rank = (item: EnrollmentSummary): number => {
    if (item.progressStatus === 'in_progress') return 0;
    if (item.progressStatus === 'not_started') return 1;
    if (item.progressStatus === 'completed') return 2;
    return 3;
  };

  return [...items].sort((a, b) => {
    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;

    // Earlier due date first within same rank
    const dueA = a.dueDate ? Date.parse(a.dueDate) : Number.POSITIVE_INFINITY;
    const dueB = b.dueDate ? Date.parse(b.dueDate) : Number.POSITIVE_INFINITY;
    if (dueA !== dueB) return dueA - dueB;

    const activityA = a.lastActivityAt ? Date.parse(a.lastActivityAt) : 0;
    const activityB = b.lastActivityAt ? Date.parse(b.lastActivityAt) : 0;
    return activityB - activityA;
  });
}

export function pickContinueEnrollment(items: EnrollmentSummary[]): EnrollmentSummary | undefined {
  const sorted = sortEnrollmentsForMyLearning(items);
  return sorted.find(
    (item) =>
      item.progressStatus === 'in_progress' &&
      (item.accessStatus === 'active' || item.accessStatus === 'ready'),
  );
}
