import type {
  Course,
  CourseAssignment,
  CourseProgress,
  CourseProgressStatus,
  CourseSection,
  ID,
  Lesson,
  Position,
  User,
} from '@/types';

export const progressStatusLabels: Record<CourseProgressStatus, string> = {
  not_started: 'Не начат',
  in_progress: 'В процессе',
  completed: 'Завершён',
  overdue: 'Просрочен',
};

export const progressStatusVariants: Record<
  CourseProgressStatus,
  'neutral' | 'primary' | 'success' | 'danger'
> = {
  not_started: 'neutral',
  in_progress: 'primary',
  completed: 'success',
  overdue: 'danger',
};

export const statusLabels = {
  draft: 'Черновик',
  published: 'Опубликован',
} satisfies Record<Course['status'], string>;

export const visibilityLabels = {
  public: 'Публичный',
  company: 'Вся компания',
  restricted: 'По назначению',
} satisfies Record<Course['visibility'], string>;

/** Декоративные обложки — у курсов пока нет coverUrl. */
const coverPalettes = [
  'from-primary-600 via-primary-500 to-teal-400',
  'from-indigo-600 via-violet-500 to-fuchsia-400',
  'from-sky-600 via-cyan-500 to-emerald-400',
  'from-amber-500 via-orange-500 to-rose-500',
  'from-slate-700 via-slate-600 to-primary-500',
];

export function courseCoverClass(courseId: string): string {
  let hash = 0;
  for (let i = 0; i < courseId.length; i += 1) hash = (hash + courseId.charCodeAt(i) * 17) % 997;
  return coverPalettes[hash % coverPalettes.length];
}

export function progressPercent(lessons: Lesson[], progress?: CourseProgress): number {
  if (lessons.length === 0) return 0;
  return Math.round(((progress?.completedLessonIds.length ?? 0) / lessons.length) * 100);
}

export function orderLessons(lessons: Lesson[], sections: CourseSection[]): Lesson[] {
  const sectionOrder = new Map(sections.map((section) => [section.id, section.order]));
  return [...lessons].sort(
    (a, b) =>
      (sectionOrder.get(a.sectionId) ?? 0) - (sectionOrder.get(b.sectionId) ?? 0) ||
      a.order - b.order,
  );
}

/** Урок заблокирован, если предыдущие (по порядку) ещё не пройдены. */
export function isLessonLocked(
  lesson: Lesson,
  orderedLessons: Lesson[],
  sequential: boolean,
  progress?: CourseProgress,
): boolean {
  if (!sequential) return false;
  const index = orderedLessons.findIndex((item) => item.id === lesson.id);
  if (index <= 0) return false;
  const completed = new Set(progress?.completedLessonIds ?? []);
  return orderedLessons.slice(0, index).some((item) => !completed.has(item.id));
}

export function userProgressFor(
  progress: CourseProgress[],
  userId: ID | undefined,
  courseId: ID,
): CourseProgress | undefined {
  if (!userId) return undefined;
  return progress.find((item) => item.userId === userId && item.courseId === courseId);
}

/** Курсы, видимые сотруднику как «мои»: назначения + company/public + начатый прогресс. */
export function resolveMyCourseIds(params: {
  courses: Course[];
  assignments: CourseAssignment[];
  progress: CourseProgress[];
  user?: User;
  positions?: Position[];
}): Set<ID> {
  const { courses, assignments, progress, user, positions = [] } = params;
  const ids = new Set<ID>();
  if (!user) return ids;

  for (const item of progress) {
    if (item.userId === user.id) ids.add(item.courseId);
  }

  for (const course of courses) {
    if (course.status !== 'published') continue;
    if (course.visibility === 'company' || course.visibility === 'public') {
      ids.add(course.id);
    }
  }

  const departmentIds = new Set(
    positions
      .filter((position) => user.positionIds.includes(position.id))
      .map((position) => position.departmentId),
  );

  for (const assignment of assignments) {
    if (assignment.assigneeType === 'user' && assignment.assigneeId === user.id) {
      ids.add(assignment.courseId);
      continue;
    }
    if (
      assignment.assigneeType === 'position' &&
      assignment.assigneeId &&
      user.positionIds.includes(assignment.assigneeId)
    ) {
      ids.add(assignment.courseId);
      continue;
    }
    if (
      assignment.assigneeType === 'department' &&
      assignment.assigneeId &&
      departmentIds.has(assignment.assigneeId)
    ) {
      ids.add(assignment.courseId);
    }
  }

  return ids;
}

export function showApiError(error: unknown, fallback = 'Что-то пошло не так. Попробуйте ещё раз.') {
  return error instanceof Error ? error.message : fallback;
}

export function firstIncompleteLesson(
  orderedLessons: Lesson[],
  progress?: CourseProgress,
): Lesson | undefined {
  const completed = new Set(progress?.completedLessonIds ?? []);
  return orderedLessons.find((lesson) => !completed.has(lesson.id)) ?? orderedLessons[0];
}
