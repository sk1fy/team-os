/**
 * Прогресс прохождения курсов — Академия Opus.
 *
 * Здесь считается то, чего не хватало базовой реализации: статус `overdue`,
 * строки отчёта для назначенных, но не начавших, и сводка над таблицей.
 */

import type {
  Course,
  CourseProgress,
  CourseProgressStatus,
  ID,
  ISODate,
  Lesson,
  QuizAttempt,
} from '@/types';
import type { LearnerAssignment, LearnerRow, ProgressSummary } from '@/types/academyOpus';
import { bestScore } from './quizScoring';

/** Доля пройденных уроков курса в процентах, 0–100. */
export function progressPercent(totalLessons: number, completedLessons: number): number {
  if (totalLessons <= 0) return 0;
  return Math.round((Math.min(completedLessons, totalLessons) / totalLessons) * 100);
}

/** Просрочен ли дедлайн на момент `now`. Завершённый курс не просрочен. */
export function isOverdue(dueDate: ISODate | undefined, completedAt: ISODate | undefined, now: Date) {
  if (!dueDate || completedAt) return false;
  return new Date(dueDate).getTime() < now.getTime();
}

/**
 * Итоговый статус строки отчёта.
 *
 * Базовый мок-API знает только not_started / in_progress / completed —
 * просрочку он не вычисляет вовсе. Считаем её здесь, поверх прогресса.
 */
export function resolveStatus(
  progress: CourseProgress | undefined,
  dueDate: ISODate | undefined,
  now: Date,
): CourseProgressStatus {
  if (progress?.status === 'completed') return 'completed';
  if (isOverdue(dueDate, progress?.completedAt, now)) return 'overdue';
  if (!progress || progress.completedLessonIds.length === 0) return 'not_started';
  return 'in_progress';
}

/** Сколько дней осталось до дедлайна; отрицательное — просрочено. */
export function daysUntilDue(dueDate: ISODate, now: Date): number {
  const startOfDay = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return Math.round((startOfDay(new Date(dueDate)) - startOfDay(now)) / 86_400_000);
}

/**
 * Строит строки отчёта по развёрнутым назначениям.
 *
 * Ключевое отличие от базовой Академии: строка появляется на каждое
 * назначение, а не только на тех, кто уже открыл курс. Иначе отчёт не
 * отвечает на главный вопрос — «кто ещё не прошёл».
 */
export function buildLearnerRows(
  assignments: LearnerAssignment[],
  progress: CourseProgress[],
  lessons: Lesson[],
  courses: Course[],
  now: Date,
): LearnerRow[] {
  const courseIds = new Set(courses.map((course) => course.id));
  const lessonsByCourse = new Map<ID, number>();
  const quizIdsByCourse = new Map<ID, Set<ID>>();

  for (const lesson of lessons) {
    lessonsByCourse.set(lesson.courseId, (lessonsByCourse.get(lesson.courseId) ?? 0) + 1);
    if (lesson.quizId) {
      const set = quizIdsByCourse.get(lesson.courseId) ?? new Set<ID>();
      set.add(lesson.quizId);
      quizIdsByCourse.set(lesson.courseId, set);
    }
  }

  const progressByKey = new Map(progress.map((item) => [`${item.userId}:${item.courseId}`, item]));

  return assignments
    .filter((assignment) => courseIds.has(assignment.courseId))
    .map((assignment) => {
      const item = progressByKey.get(`${assignment.userId}:${assignment.courseId}`);
      const totalLessons = lessonsByCourse.get(assignment.courseId) ?? 0;
      const completedLessons = item?.completedLessonIds.length ?? 0;
      const courseQuizIds = quizIdsByCourse.get(assignment.courseId) ?? new Set<ID>();
      const attempts = (item?.quizAttempts ?? []).filter((attempt) =>
        courseQuizIds.has(attempt.quizId),
      );

      return {
        userId: assignment.userId,
        courseId: assignment.courseId,
        status: resolveStatus(item, assignment.dueDate, now),
        percent: progressPercent(totalLessons, completedLessons),
        completedLessons,
        totalLessons,
        assignedAt: assignment.assignedAt,
        dueDate: assignment.dueDate,
        startedAt: item?.startedAt,
        completedAt: item?.completedAt,
        pendingReview: attempts.some((attempt) => attempt.pendingReview),
        bestScore: bestScore(attempts),
        via: assignment.via,
      };
    });
}

/** Сводка над таблицей отчёта. */
export function summarize(rows: LearnerRow[]): ProgressSummary {
  const summary: ProgressSummary = {
    assigned: rows.length,
    notStarted: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0,
    averagePercent: 0,
    pendingReview: 0,
  };

  for (const row of rows) {
    if (row.status === 'not_started') summary.notStarted += 1;
    if (row.status === 'in_progress') summary.inProgress += 1;
    if (row.status === 'completed') summary.completed += 1;
    if (row.status === 'overdue') summary.overdue += 1;
    if (row.pendingReview) summary.pendingReview += 1;
  }

  if (rows.length > 0) {
    const total = rows.reduce((sum, row) => sum + row.percent, 0);
    summary.averagePercent = Math.round(total / rows.length);
  }

  return summary;
}

/**
 * Урок, с которого стоит продолжить: первый непройденный по порядку курса.
 * Возвращает undefined, если пройдено всё.
 */
export function resumeLessonId(
  lessons: Lesson[],
  progress: CourseProgress | undefined,
): ID | undefined {
  const completed = new Set(progress?.completedLessonIds ?? []);
  return lessons.find((lesson) => !completed.has(lesson.id))?.id;
}

/**
 * Открыт ли урок при последовательном прохождении: доступен первый
 * непройденный и всё, что до него.
 */
export function isLessonUnlocked(
  lessons: Lesson[],
  progress: CourseProgress | undefined,
  lessonId: ID,
  sequential: boolean,
): boolean {
  if (!sequential) return true;
  const completed = new Set(progress?.completedLessonIds ?? []);
  if (completed.has(lessonId)) return true;

  const index = lessons.findIndex((lesson) => lesson.id === lessonId);
  if (index === -1) return false;
  return lessons.slice(0, index).every((lesson) => completed.has(lesson.id));
}

/** Отсев по урокам: сколько назначенных дошло до каждого урока. */
export function lessonDropOff(
  lessons: Lesson[],
  progress: CourseProgress[],
  assignedUserIds: Set<ID>,
): Array<{ lessonId: ID; title: string; completed: number }> {
  const relevant = progress.filter((item) => assignedUserIds.has(item.userId));
  return lessons.map((lesson) => ({
    lessonId: lesson.id,
    title: lesson.title,
    completed: relevant.filter((item) => item.completedLessonIds.includes(lesson.id)).length,
  }));
}

/** Попытки по всем тестам курса — для очереди проверки и отчёта. */
export function courseAttempts(progress: CourseProgress[], quizIds: Set<ID>): QuizAttempt[] {
  return progress.flatMap((item) =>
    item.quizAttempts.filter((attempt) => quizIds.has(attempt.quizId)),
  );
}
