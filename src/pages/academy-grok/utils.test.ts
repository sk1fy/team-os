import { describe, expect, it } from 'vitest';
import type { Course, CourseProgress, CourseSection, Lesson, User } from '@/types';
import {
  isLessonLocked,
  orderLessons,
  progressPercent,
  resolveMyCourseIds,
} from './utils';

const sections: CourseSection[] = [
  { id: 's1', courseId: 'c1', title: 'A', order: 1 },
  { id: 's0', courseId: 'c1', title: 'B', order: 0 },
];

const lessons: Lesson[] = [
  {
    id: 'l2',
    courseId: 'c1',
    sectionId: 's1',
    title: 'Second section lesson',
    order: 0,
    content: { type: 'doc', content: [] },
  },
  {
    id: 'l1',
    courseId: 'c1',
    sectionId: 's0',
    title: 'First',
    order: 0,
    content: { type: 'doc', content: [] },
  },
  {
    id: 'l1b',
    courseId: 'c1',
    sectionId: 's0',
    title: 'First B',
    order: 1,
    content: { type: 'doc', content: [] },
  },
];

describe('academy-grok utils', () => {
  it('сортирует уроки по разделам и order', () => {
    expect(orderLessons(lessons, sections).map((item) => item.id)).toEqual(['l1', 'l1b', 'l2']);
  });

  it('считает прогресс в процентах', () => {
    const progress: CourseProgress = {
      userId: 'u1',
      courseId: 'c1',
      status: 'in_progress',
      completedLessonIds: ['l1'],
      quizAttempts: [],
    };
    expect(progressPercent(orderLessons(lessons, sections), progress)).toBe(33);
  });

  it('блокирует следующие уроки в sequential-режиме', () => {
    const ordered = orderLessons(lessons, sections);
    const progress: CourseProgress = {
      userId: 'u1',
      courseId: 'c1',
      status: 'in_progress',
      completedLessonIds: ['l1'],
      quizAttempts: [],
    };
    expect(isLessonLocked(ordered[0], ordered, true, progress)).toBe(false);
    expect(isLessonLocked(ordered[1], ordered, true, progress)).toBe(false);
    expect(isLessonLocked(ordered[2], ordered, true, progress)).toBe(true);
    expect(isLessonLocked(ordered[2], ordered, false, progress)).toBe(false);
  });

  it('собирает «мои» курсы из visibility, progress и assignments', () => {
    const user = {
      id: 'u1',
      positionIds: ['pos-1'],
    } as User;
    const courses = [
      { id: 'c-company', status: 'published', visibility: 'company' },
      { id: 'c-restricted', status: 'published', visibility: 'restricted' },
      { id: 'c-draft', status: 'draft', visibility: 'company' },
    ] as Course[];

    const ids = resolveMyCourseIds({
      courses,
      user,
      positions: [{ id: 'pos-1', departmentId: 'dep-1' } as never],
      progress: [
        {
          userId: 'u1',
          courseId: 'c-restricted',
          status: 'in_progress',
          completedLessonIds: [],
          quizAttempts: [],
        },
      ],
      assignments: [
        {
          id: 'a1',
          courseId: 'c-extra',
          assigneeType: 'position',
          assigneeId: 'pos-1',
          assignedById: 'admin',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'a2',
          courseId: 'c-dept',
          assigneeType: 'department',
          assigneeId: 'dep-1',
          assignedById: 'admin',
          createdAt: new Date().toISOString(),
        },
      ],
    });

    expect(ids.has('c-company')).toBe(true);
    expect(ids.has('c-restricted')).toBe(true);
    expect(ids.has('c-extra')).toBe(true);
    expect(ids.has('c-dept')).toBe(true);
    expect(ids.has('c-draft')).toBe(false);
  });
});
