import { describe, expect, it } from 'vitest';
import type { Course, CourseAssignment, Position, User } from '@/types';
import {
  assignmentTargetsUser,
  expandAssignments,
  missingRequiredAssignments,
  requiredCourseIdsFor,
  resolveDueDate,
} from './courseAssignments';

const positions: Position[] = [
  {
    id: 'position-sales',
    name: 'Менеджер',
    departmentId: 'department-sales',
    articleIds: [],
    requiredCourseIds: ['course-1'],
  },
  {
    id: 'position-dev',
    name: 'Разработчик',
    departmentId: 'department-dev',
    articleIds: [],
    requiredCourseIds: [],
  },
];

function makeUser(input: Partial<User> & Pick<User, 'id'>): User {
  return {
    id: input.id,
    email: `${input.id}@example.com`,
    firstName: 'Имя',
    lastName: 'Фамилия',
    role: input.role ?? 'employee',
    status: input.status ?? 'active',
    positionIds: input.positionIds ?? [],
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeCourse(input: Partial<Course> & Pick<Course, 'id'>): Course {
  return {
    id: input.id,
    title: input.title ?? input.id,
    status: 'published',
    visibility: 'restricted',
    authorId: 'user-1',
    sequential: true,
    deadlineDays: input.deadlineDays,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeAssignment(input: Partial<CourseAssignment> & Pick<CourseAssignment, 'id'>) {
  return {
    id: input.id,
    courseId: input.courseId ?? 'course-1',
    assigneeType: input.assigneeType ?? 'user',
    assigneeId: input.assigneeId,
    dueDate: input.dueDate,
    assignedById: 'user-1',
    createdAt: input.createdAt ?? '2026-07-01T00:00:00.000Z',
  } as CourseAssignment;
}

const sales = makeUser({ id: 'user-sales', positionIds: ['position-sales'] });
const dev = makeUser({ id: 'user-dev', positionIds: ['position-dev'] });

describe('assignmentTargetsUser', () => {
  it('находит адресата персонального назначения', () => {
    const assignment = makeAssignment({ id: 'a1', assigneeType: 'user', assigneeId: 'user-sales' });
    expect(assignmentTargetsUser(assignment, sales, positions)).toBe(true);
    expect(assignmentTargetsUser(assignment, dev, positions)).toBe(false);
  });

  it('разворачивает назначение на должность', () => {
    const assignment = makeAssignment({
      id: 'a1',
      assigneeType: 'position',
      assigneeId: 'position-sales',
    });
    expect(assignmentTargetsUser(assignment, sales, positions)).toBe(true);
    expect(assignmentTargetsUser(assignment, dev, positions)).toBe(false);
  });

  it('разворачивает назначение на отдел через должность человека', () => {
    const assignment = makeAssignment({
      id: 'a1',
      assigneeType: 'department',
      assigneeId: 'department-sales',
    });
    expect(assignmentTargetsUser(assignment, sales, positions)).toBe(true);
    expect(assignmentTargetsUser(assignment, dev, positions)).toBe(false);
  });

  it('не адресует внешнее приглашение сотрудникам', () => {
    const assignment = makeAssignment({ id: 'a1', assigneeType: 'external' });
    expect(assignmentTargetsUser(assignment, sales, positions)).toBe(false);
  });
});

describe('resolveDueDate', () => {
  it('берёт явный дедлайн назначения', () => {
    const assignment = makeAssignment({ id: 'a1', dueDate: '2026-08-01T00:00:00.000Z' });
    expect(resolveDueDate(assignment, makeCourse({ id: 'course-1', deadlineDays: 3 }))).toBe(
      '2026-08-01T00:00:00.000Z',
    );
  });

  it('считает дедлайн от даты назначения и deadlineDays курса', () => {
    const assignment = makeAssignment({ id: 'a1', createdAt: '2026-07-01T00:00:00.000Z' });
    const due = resolveDueDate(assignment, makeCourse({ id: 'course-1', deadlineDays: 7 }));
    expect(due).toBe('2026-07-08T00:00:00.000Z');
  });

  it('без deadlineDays и явной даты дедлайна нет', () => {
    expect(resolveDueDate(makeAssignment({ id: 'a1' }), makeCourse({ id: 'course-1' }))).toBeUndefined();
  });
});

describe('expandAssignments', () => {
  const courses = [makeCourse({ id: 'course-1', deadlineDays: 7 })];

  it('создаёт строку на каждого адресата группового назначения', () => {
    const rows = expandAssignments(
      [makeAssignment({ id: 'a1', assigneeType: 'department', assigneeId: 'department-sales' })],
      [sales, dev],
      positions,
      courses,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe('user-sales');
    expect(rows[0].via).toBe('department');
  });

  it('схлопывает дубли по паре человек-курс, оставляя самый строгий дедлайн', () => {
    const rows = expandAssignments(
      [
        makeAssignment({
          id: 'a1',
          assigneeType: 'department',
          assigneeId: 'department-sales',
          dueDate: '2026-08-20T00:00:00.000Z',
        }),
        makeAssignment({
          id: 'a2',
          assigneeType: 'user',
          assigneeId: 'user-sales',
          dueDate: '2026-08-05T00:00:00.000Z',
        }),
      ],
      [sales],
      positions,
      courses,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].dueDate).toBe('2026-08-05T00:00:00.000Z');
  });

  it('пропускает уволенных и внешние приглашения', () => {
    const fired = makeUser({
      id: 'user-fired',
      positionIds: ['position-sales'],
      status: 'deactivated',
    });
    const rows = expandAssignments(
      [
        makeAssignment({ id: 'a1', assigneeType: 'position', assigneeId: 'position-sales' }),
        makeAssignment({ id: 'a2', assigneeType: 'external' }),
      ],
      [sales, fired],
      positions,
      courses,
    );

    expect(rows.map((row) => row.userId)).toEqual(['user-sales']);
  });

  it('игнорирует назначения на несуществующий курс', () => {
    const rows = expandAssignments(
      [makeAssignment({ id: 'a1', courseId: 'course-missing', assigneeId: 'user-sales' })],
      [sales],
      positions,
      courses,
    );
    expect(rows).toHaveLength(0);
  });
});

describe('обязательные курсы должности', () => {
  it('собирает требуемые курсы по должностям человека', () => {
    expect(requiredCourseIdsFor(sales, positions)).toEqual(['course-1']);
    expect(requiredCourseIdsFor(dev, positions)).toEqual([]);
  });

  it('находит непокрытые обязательные курсы', () => {
    expect(missingRequiredAssignments([sales, dev], positions, [])).toEqual([
      { userId: 'user-sales', courseId: 'course-1' },
    ]);
  });

  it('считает курс покрытым, если есть назначение на отдел', () => {
    const assignment = makeAssignment({
      id: 'a1',
      assigneeType: 'department',
      assigneeId: 'department-sales',
    });
    expect(missingRequiredAssignments([sales], positions, [assignment])).toEqual([]);
  });
});
