import type { Course, CourseAssignment, Position, User } from '@/types';

export function canAccessCourse(
  course: Course,
  user: User | undefined,
  assignments: CourseAssignment[],
  positions: Position[],
) {
  if (user?.role === 'owner' || user?.role === 'admin') return true;
  if (course.status !== 'published') return false;
  if (course.visibility === 'public') return true;
  if (!user || user.status !== 'active') return false;
  if (course.visibility === 'company') return true;

  const departmentIds = new Set(
    positions
      .filter((position) => user.positionIds.includes(position.id))
      .map((position) => position.departmentId),
  );
  return assignments.some(
    (assignment) =>
      assignment.courseId === course.id &&
      ((assignment.assigneeType === 'user' && assignment.assigneeId === user.id) ||
        (assignment.assigneeType === 'position' &&
          Boolean(assignment.assigneeId && user.positionIds.includes(assignment.assigneeId))) ||
        (assignment.assigneeType === 'department' &&
          Boolean(assignment.assigneeId && departmentIds.has(assignment.assigneeId)))),
  );
}
