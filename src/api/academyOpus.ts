/**
 * HTTP-адаптер «Академии Opus».
 *
 * Opus и Grok — альтернативные интерфейсы над одним серверным модулем
 * Академии. Здесь нет фикстур или сессионного состояния: базовые сущности
 * загружаются через HTTP, а расширенные представления отчётов вычисляются
 * только из полученных от сервера данных.
 */

import { httpAcademyApi, httpAuthApi, httpOrgApi } from './http';
import {
  expandAssignments,
  missingRequiredAssignments,
  resolveDueDate,
} from '@/lib/courseAssignments';
import { buildLearnerRows, lessonDropOff } from '@/lib/courseProgress';
import type { Course, CourseAssignment, ID, Lesson } from '@/types';

async function getServerSnapshot() {
  const [courses, lessons, assignments, progress, users, positions] = await Promise.all([
    httpAcademyApi.getCourses(),
    httpAcademyApi.getLessons(),
    httpAcademyApi.getAssignments(),
    httpAcademyApi.getProgress(),
    httpOrgApi.getUsers(),
    httpOrgApi.getPositions(),
  ]);

  return { courses, lessons, assignments, progress, users, positions };
}

function orderLessons(lessons: Lesson[], sectionOrder: Map<ID, number>): Lesson[] {
  return lessons.slice().sort((a, b) => {
    const sectionDiff = (sectionOrder.get(a.sectionId) ?? 0) - (sectionOrder.get(b.sectionId) ?? 0);
    return sectionDiff !== 0 ? sectionDiff : a.order - b.order;
  });
}

export const academyOpusApi = {
  getCourses: httpAcademyApi.getCourses,
  getCourse: httpAcademyApi.getCourse,
  getSections: httpAcademyApi.getCourseSections,
  getLessons: httpAcademyApi.getLessons,
  getQuizzes: () => httpAcademyApi.getQuizzes(),
  getProgress: httpAcademyApi.getProgress,
  getAssignments: httpAcademyApi.getAssignments,
  assignCourse: httpAcademyApi.assignCourse,
  markLessonComplete: httpAcademyApi.markLessonComplete,
  updateCourse: httpAcademyApi.updateCourse,
  upsertQuiz: httpAcademyApi.upsertQuiz,

  getMyAssignments: async () => {
    const [user, courses, assignments, positions] = await Promise.all([
      httpAuthApi.getCurrentUser(),
      httpAcademyApi.getCourses(),
      httpAcademyApi.getAssignments(),
      httpOrgApi.getPositions(),
    ]);
    return expandAssignments(assignments, [user], positions, courses);
  },

  syncRequiredAssignments: async (): Promise<number> => {
    const { courses, assignments, users, positions } = await getServerSnapshot();
    const accessibleCourseIds = new Set(courses.map((course) => course.id));
    const missing = missingRequiredAssignments(users, positions, assignments).filter((item) =>
      accessibleCourseIds.has(item.courseId),
    );

    await Promise.all(
      missing.map((item) =>
        httpAcademyApi.assignCourse({
          courseId: item.courseId,
          assigneeType: 'user',
          assigneeId: item.userId,
        }),
      ),
    );
    return missing.length;
  },

  getLearnerRows: async () => {
    const { courses, lessons, assignments, progress, users, positions } = await getServerSnapshot();
    const expanded = expandAssignments(assignments, users, positions, courses);
    return buildLearnerRows(expanded, progress, lessons, courses, new Date());
  },

  getCourseDropOff: async (courseId: ID) => {
    const [{ courses, lessons, assignments, progress, users, positions }, sections] =
      await Promise.all([getServerSnapshot(), httpAcademyApi.getCourseSections(courseId)]);
    const assignedUserIds = new Set(
      expandAssignments(
        assignments.filter((assignment) => assignment.courseId === courseId),
        users,
        positions,
        courses,
      ).map((assignment) => assignment.userId),
    );
    const sectionOrder = new Map(sections.map((section) => [section.id, section.order]));
    const courseLessons = orderLessons(
      lessons.filter((lesson) => lesson.courseId === courseId),
      sectionOrder,
    );
    return lessonDropOff(courseLessons, progress, assignedUserIds);
  },

  dueDateFor: (assignment: CourseAssignment, course?: Course) => resolveDueDate(assignment, course),
};
