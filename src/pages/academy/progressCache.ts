import type { CourseProgress } from '@/types';

export function upsertCourseProgress(
  current: CourseProgress[] | undefined,
  updated: CourseProgress,
): CourseProgress[] {
  return [
    ...(current ?? []).filter(
      (item) => item.courseId !== updated.courseId || item.userId !== updated.userId,
    ),
    updated,
  ];
}
