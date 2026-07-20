/**
 * Развёртка назначений курсов до конкретных людей — Академия Opus.
 *
 * В базовом контракте назначение может указывать на должность или отдел.
 * Отчёт и раздел «Моё обучение» должны работать с людьми, поэтому групповые
 * назначения раскрываются здесь, один раз, а не в каждом компоненте.
 */

import type { Course, CourseAssignment, ID, ISODate, Position, User } from '@/types';
import type { LearnerAssignment } from '@/types/academyOpus';

const DAY_MS = 86_400_000;

/** Отделы, к которым человек относится через свои должности. */
export function departmentIdsOf(user: User, positions: Position[]): Set<ID> {
  return new Set(
    positions
      .filter((position) => user.positionIds.includes(position.id))
      .map((position) => position.departmentId),
  );
}

/**
 * Адресовано ли назначение этому человеку. Внешние приглашения (external)
 * никому из сотрудников не адресованы — у них свой сценарий по инвайт-ссылке.
 */
export function assignmentTargetsUser(
  assignment: CourseAssignment,
  user: User,
  positions: Position[],
): boolean {
  switch (assignment.assigneeType) {
    case 'user':
      return assignment.assigneeId === user.id;
    case 'position':
      return Boolean(assignment.assigneeId && user.positionIds.includes(assignment.assigneeId));
    case 'department':
      return Boolean(
        assignment.assigneeId && departmentIdsOf(user, positions).has(assignment.assigneeId),
      );
    default:
      return false;
  }
}

/**
 * Итоговый дедлайн назначения: явная дата важнее, иначе считаем от даты
 * назначения плюс deadlineDays курса.
 */
export function resolveDueDate(
  assignment: CourseAssignment,
  course: Course | undefined,
): ISODate | undefined {
  if (assignment.dueDate) return assignment.dueDate;
  if (!course?.deadlineDays) return undefined;
  return new Date(new Date(assignment.createdAt).getTime() + course.deadlineDays * DAY_MS)
    .toISOString();
}

/**
 * Разворачивает все назначения в строки «человек × курс».
 *
 * Один человек может получить курс несколькими путями (лично и через отдел) —
 * такие дубли схлопываются в одну строку с самым ранним дедлайном, потому что
 * для сотрудника действует самое строгое требование.
 */
export function expandAssignments(
  assignments: CourseAssignment[],
  users: User[],
  positions: Position[],
  courses: Course[],
): LearnerAssignment[] {
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const byKey = new Map<string, LearnerAssignment>();

  for (const assignment of assignments) {
    if (assignment.assigneeType === 'external') continue;
    const course = courseById.get(assignment.courseId);
    if (!course) continue;

    for (const user of users) {
      if (user.status === 'deactivated') continue;
      if (!assignmentTargetsUser(assignment, user, positions)) continue;

      const row: LearnerAssignment = {
        userId: user.id,
        courseId: assignment.courseId,
        assignmentId: assignment.id,
        assignedAt: assignment.createdAt,
        dueDate: resolveDueDate(assignment, course),
        via: assignment.assigneeType,
      };

      const key = `${user.id}:${assignment.courseId}`;
      const existing = byKey.get(key);
      if (!existing || isStricter(row, existing)) byKey.set(key, row);
    }
  }

  return [...byKey.values()];
}

/** Строгее то назначение, у которого дедлайн раньше; дедлайн вообще важнее его отсутствия. */
function isStricter(candidate: LearnerAssignment, current: LearnerAssignment): boolean {
  if (!candidate.dueDate) return false;
  if (!current.dueDate) return true;
  return new Date(candidate.dueDate).getTime() < new Date(current.dueDate).getTime();
}

/** Обязательные курсы должностей человека — источник автоназначения. */
export function requiredCourseIdsFor(user: User, positions: Position[]): ID[] {
  const ids = new Set<ID>();
  for (const position of positions) {
    if (!user.positionIds.includes(position.id)) continue;
    for (const courseId of position.requiredCourseIds) ids.add(courseId);
  }
  return [...ids];
}

/**
 * Каких обязательных по должности курсов человеку ещё не назначили.
 * На этом строится кнопка «Досоздать назначения» в отчёте.
 */
export function missingRequiredAssignments(
  users: User[],
  positions: Position[],
  assignments: CourseAssignment[],
): Array<{ userId: ID; courseId: ID }> {
  const missing: Array<{ userId: ID; courseId: ID }> = [];

  for (const user of users) {
    if (user.status === 'deactivated') continue;
    for (const courseId of requiredCourseIdsFor(user, positions)) {
      const covered = assignments.some(
        (assignment) =>
          assignment.courseId === courseId && assignmentTargetsUser(assignment, user, positions),
      );
      if (!covered) missing.push({ userId: user.id, courseId });
    }
  }

  return missing;
}
