import { describe, expect, it } from 'vitest';
import type { Course, CourseProgress, Lesson } from '@/types';
import type { LearnerAssignment } from '@/types/academyOpus';
import {
  buildLearnerRows,
  daysUntilDue,
  isLessonUnlocked,
  isOverdue,
  lessonDropOff,
  progressPercent,
  resolveStatus,
  resumeLessonId,
  summarize,
} from './courseProgress';

const now = new Date('2026-07-20T12:00:00.000Z');

const lessons: Lesson[] = [
  {
    id: 'lesson-1',
    courseId: 'course-1',
    sectionId: 'section-1',
    title: 'Первый',
    order: 0,
    content: { type: 'doc' },
  },
  {
    id: 'lesson-2',
    courseId: 'course-1',
    sectionId: 'section-1',
    title: 'Второй',
    order: 1,
    content: { type: 'doc' },
    quizId: 'quiz-1',
  },
];

const courses: Course[] = [
  {
    id: 'course-1',
    title: 'Курс',
    status: 'published',
    visibility: 'restricted',
    authorId: 'user-1',
    sequential: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

function makeAssignment(input: Partial<LearnerAssignment> = {}): LearnerAssignment {
  return {
    userId: input.userId ?? 'user-1',
    courseId: input.courseId ?? 'course-1',
    assignmentId: input.assignmentId ?? 'assignment-1',
    assignedAt: input.assignedAt ?? '2026-07-01T00:00:00.000Z',
    dueDate: input.dueDate,
    via: input.via ?? 'user',
  };
}

function makeProgress(input: Partial<CourseProgress> = {}): CourseProgress {
  return {
    userId: input.userId ?? 'user-1',
    courseId: input.courseId ?? 'course-1',
    status: input.status ?? 'in_progress',
    completedLessonIds: input.completedLessonIds ?? [],
    quizAttempts: input.quizAttempts ?? [],
    startedAt: input.startedAt,
    completedAt: input.completedAt,
  };
}

describe('progressPercent', () => {
  it('считает долю пройденных уроков', () => {
    expect(progressPercent(4, 1)).toBe(25);
    expect(progressPercent(3, 3)).toBe(100);
  });

  it('не делит на ноль в курсе без уроков', () => {
    expect(progressPercent(0, 0)).toBe(0);
  });

  it('не превышает 100 при лишних отметках', () => {
    expect(progressPercent(2, 5)).toBe(100);
  });
});

describe('resolveStatus', () => {
  it('не начат без прогресса', () => {
    expect(resolveStatus(undefined, undefined, now)).toBe('not_started');
  });

  it('в процессе при частичном прохождении', () => {
    expect(resolveStatus(makeProgress({ completedLessonIds: ['lesson-1'] }), undefined, now)).toBe(
      'in_progress',
    );
  });

  it('просрочен, если дедлайн прошёл, а курс не завершён', () => {
    expect(resolveStatus(undefined, '2026-07-10T00:00:00.000Z', now)).toBe('overdue');
  });

  it('завершённый курс не считается просроченным', () => {
    const progress = makeProgress({
      status: 'completed',
      completedAt: '2026-07-05T00:00:00.000Z',
      completedLessonIds: ['lesson-1', 'lesson-2'],
    });
    expect(resolveStatus(progress, '2026-07-10T00:00:00.000Z', now)).toBe('completed');
  });

  it('будущий дедлайн просрочку не даёт', () => {
    expect(resolveStatus(undefined, '2026-08-01T00:00:00.000Z', now)).toBe('not_started');
  });
});

describe('isOverdue и daysUntilDue', () => {
  it('без дедлайна просрочки нет', () => {
    expect(isOverdue(undefined, undefined, now)).toBe(false);
  });

  it('считает остаток дней до дедлайна', () => {
    expect(daysUntilDue('2026-07-25T00:00:00.000Z', now)).toBe(5);
    expect(daysUntilDue('2026-07-15T00:00:00.000Z', now)).toBe(-5);
  });
});

describe('buildLearnerRows', () => {
  it('создаёт строку даже для не начавшего курс', () => {
    const rows = buildLearnerRows([makeAssignment()], [], lessons, courses, now);

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('not_started');
    expect(rows[0].percent).toBe(0);
    expect(rows[0].totalLessons).toBe(2);
  });

  it('подтягивает прогресс и лучший балл по тестам курса', () => {
    const progress = makeProgress({
      completedLessonIds: ['lesson-1'],
      quizAttempts: [
        {
          id: 'attempt-1',
          quizId: 'quiz-1',
          userId: 'user-1',
          score: 60,
          passed: false,
          pendingReview: false,
          createdAt: '2026-07-10T00:00:00.000Z',
        },
        {
          id: 'attempt-2',
          quizId: 'quiz-1',
          userId: 'user-1',
          score: 90,
          passed: true,
          pendingReview: false,
          createdAt: '2026-07-11T00:00:00.000Z',
        },
      ],
    });
    const rows = buildLearnerRows([makeAssignment()], [progress], lessons, courses, now);

    expect(rows[0].percent).toBe(50);
    expect(rows[0].bestScore).toBe(90);
    expect(rows[0].status).toBe('in_progress');
  });

  it('помечает строку, если попытка ждёт проверки', () => {
    const progress = makeProgress({
      quizAttempts: [
        {
          id: 'attempt-1',
          quizId: 'quiz-1',
          userId: 'user-1',
          score: 0,
          passed: false,
          pendingReview: true,
          createdAt: '2026-07-10T00:00:00.000Z',
        },
      ],
    });
    const rows = buildLearnerRows([makeAssignment()], [progress], lessons, courses, now);
    expect(rows[0].pendingReview).toBe(true);
  });

  it('не учитывает попытки по тестам чужого курса', () => {
    const progress = makeProgress({
      quizAttempts: [
        {
          id: 'attempt-1',
          quizId: 'quiz-other',
          userId: 'user-1',
          score: 100,
          passed: true,
          pendingReview: false,
          createdAt: '2026-07-10T00:00:00.000Z',
        },
      ],
    });
    const rows = buildLearnerRows([makeAssignment()], [progress], lessons, courses, now);
    expect(rows[0].bestScore).toBeUndefined();
  });
});

describe('summarize', () => {
  it('считает распределение по статусам и средний процент', () => {
    const rows = buildLearnerRows(
      [
        makeAssignment({ userId: 'user-1' }),
        makeAssignment({ userId: 'user-2', dueDate: '2026-07-01T00:00:00.000Z' }),
      ],
      [makeProgress({ userId: 'user-1', completedLessonIds: ['lesson-1'] })],
      lessons,
      courses,
      now,
    );
    const summary = summarize(rows);

    expect(summary.assigned).toBe(2);
    expect(summary.inProgress).toBe(1);
    expect(summary.overdue).toBe(1);
    expect(summary.averagePercent).toBe(25);
  });

  it('на пустом наборе даёт нули без деления на ноль', () => {
    expect(summarize([])).toMatchObject({ assigned: 0, averagePercent: 0 });
  });
});

describe('resumeLessonId', () => {
  it('возвращает первый непройденный урок', () => {
    expect(resumeLessonId(lessons, makeProgress({ completedLessonIds: ['lesson-1'] }))).toBe(
      'lesson-2',
    );
  });

  it('возвращает первый урок без прогресса', () => {
    expect(resumeLessonId(lessons, undefined)).toBe('lesson-1');
  });

  it('возвращает undefined, когда пройдено всё', () => {
    const progress = makeProgress({ completedLessonIds: ['lesson-1', 'lesson-2'] });
    expect(resumeLessonId(lessons, progress)).toBeUndefined();
  });
});

describe('isLessonUnlocked', () => {
  it('без последовательного прохождения открыто всё', () => {
    expect(isLessonUnlocked(lessons, undefined, 'lesson-2', false)).toBe(true);
  });

  it('закрывает урок, пока предыдущий не пройден', () => {
    expect(isLessonUnlocked(lessons, undefined, 'lesson-2', true)).toBe(false);
  });

  it('открывает следующий урок после прохождения предыдущего', () => {
    const progress = makeProgress({ completedLessonIds: ['lesson-1'] });
    expect(isLessonUnlocked(lessons, progress, 'lesson-2', true)).toBe(true);
  });

  it('позволяет вернуться к пройденному уроку', () => {
    const progress = makeProgress({ completedLessonIds: ['lesson-1', 'lesson-2'] });
    expect(isLessonUnlocked(lessons, progress, 'lesson-1', true)).toBe(true);
  });
});

describe('lessonDropOff', () => {
  it('считает дошедших до каждого урока только среди назначенных', () => {
    const progress = [
      makeProgress({ userId: 'user-1', completedLessonIds: ['lesson-1', 'lesson-2'] }),
      makeProgress({ userId: 'user-2', completedLessonIds: ['lesson-1'] }),
      makeProgress({ userId: 'user-outsider', completedLessonIds: ['lesson-1', 'lesson-2'] }),
    ];
    const result = lessonDropOff(lessons, progress, new Set(['user-1', 'user-2']));

    expect(result).toEqual([
      { lessonId: 'lesson-1', title: 'Первый', completed: 2 },
      { lessonId: 'lesson-2', title: 'Второй', completed: 1 },
    ]);
  });
});
