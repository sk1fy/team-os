import { describe, expect, it } from 'vitest';
import type { CourseProgress } from '@/types';
import { upsertCourseProgress } from './progressCache';

const progress = (courseId: string, userId: string, lessons: string[]): CourseProgress => ({
  courseId,
  userId,
  status: 'in_progress',
  completedLessonIds: lessons,
  quizAttempts: [],
  startedAt: '2026-07-17T12:00:00.000Z',
});

describe('upsertCourseProgress', () => {
  it('adds progress to an empty cache', () => {
    const updated = progress('course-1', 'user-1', ['lesson-1']);

    expect(upsertCourseProgress(undefined, updated)).toEqual([updated]);
  });

  it('replaces progress for the same course and user without touching other records', () => {
    const other = progress('course-2', 'user-1', []);
    const updated = progress('course-1', 'user-1', ['lesson-1', 'lesson-2']);

    expect(upsertCourseProgress([progress('course-1', 'user-1', []), other], updated)).toEqual([
      other,
      updated,
    ]);
  });
});
