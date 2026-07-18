import { describe, expect, it } from 'vitest';
import type { Course, CourseAssignment, Position, User } from '@/types';
import { canAccessCourse } from './contentVisibility';

const course = (visibility: Course['visibility'], status: Course['status'] = 'published') =>
  ({ id: 'course', visibility, status }) as Course;
const user = (role: User['role'], positionIds: string[] = []) =>
  ({ id: 'user', role, positionIds, status: 'active' }) as User;
const position = { id: 'position', departmentId: 'department' } as Position;

describe('canAccessCourse', () => {
  it('открывает публичный курс без авторизации', () => {
    expect(canAccessCourse(course('public'), undefined, [], [])).toBe(true);
  });

  it('открывает company-курс активному сотруднику', () => {
    expect(canAccessCourse(course('company'), user('employee'), [], [])).toBe(true);
    expect(canAccessCourse(course('company'), undefined, [], [])).toBe(false);
  });

  it('проверяет личное, должностное и отдельское назначение', () => {
    const assignments: CourseAssignment[] = [
      {
        id: 'assignment',
        courseId: 'course',
        assigneeType: 'department',
        assigneeId: 'department',
        assignedById: 'owner',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    expect(
      canAccessCourse(course('restricted'), user('employee', ['position']), assignments, [
        position,
      ]),
    ).toBe(true);
    expect(canAccessCourse(course('restricted'), user('employee'), assignments, [position])).toBe(
      false,
    );
  });

  it('даёт owner/admin доступ к черновикам', () => {
    expect(canAccessCourse(course('restricted', 'draft'), user('owner'), [], [])).toBe(true);
    expect(canAccessCourse(course('restricted', 'draft'), user('admin'), [], [])).toBe(true);
    expect(canAccessCourse(course('public', 'draft'), user('employee'), [], [])).toBe(false);
  });
});
