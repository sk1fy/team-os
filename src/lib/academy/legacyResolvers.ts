/**
 * Legacy player URLs use courseId; V2 player uses enrollmentId.
 * Resolver finds the current enrollment for the signed-in user.
 */

import type { ID } from '@/types';
import type { EnrollmentSummary } from '@/types/academy';

export function resolveEnrollmentIdForLegacyCourse(
  courseId: ID,
  enrollments: EnrollmentSummary[],
): ID | null {
  const forCourse = enrollments.filter((e) => e.courseId === courseId);
  if (forCourse.length === 0) return null;

  const preferred =
    forCourse.find((e) => e.progressStatus === 'in_progress' && e.accessStatus === 'active') ??
    forCourse.find((e) => e.progressStatus === 'not_started') ??
    forCourse.find((e) => e.progressStatus === 'completed') ??
    forCourse[0];

  return preferred?.id ?? null;
}
