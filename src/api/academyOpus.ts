/**
 * Мок-API «Академии Opus».
 *
 * Работает с теми же фикстурами, что и базовая Академия (db.courses,
 * db.lessons, db.courseProgress…), поэтому обе реализации показывают одни
 * и те же курсы и их можно сравнивать на одинаковых данных.
 *
 * Своё состояние тут только там, где базового контракта не хватает:
 * развёрнутые ответы на тесты и выданные сертификаты.
 *
 * Сигнатуры — контракт с будущим бэкендом ровно так же, как в academyApi:
 * при появлении реального API меняются реализации, но не сигнатуры.
 */

import { ApiError, mockRequest, notFound } from './client';
import * as db from './fixtures';
import { canAccessCourse } from '@/lib/contentVisibility';
import { createId } from '@/lib/id';
import {
  expandAssignments,
  missingRequiredAssignments,
  resolveDueDate,
} from '@/lib/courseAssignments';
import { buildLearnerRows, isLessonUnlocked, lessonDropOff } from '@/lib/courseProgress';
import { attemptsOf, canAttempt, gradeQuiz, gradeWithReview } from '@/lib/quizScoring';
import type {
  Course,
  CourseAssignment,
  CourseProgress,
  CourseSection,
  ID,
  Lesson,
  Quiz,
  QuizAttempt,
  User,
} from '@/types';
import type {
  Certificate,
  LearnerAssignment,
  LearnerRow,
  QuizAnswer,
  QuizAttemptDetail,
  QuizGrade,
  ReviewQueueItem,
} from '@/types/academyOpus';

const uid = createId;
const now = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Собственное состояние модуля (переживает только текущую сессию, как фикстуры)
// ---------------------------------------------------------------------------

const attemptDetails: QuizAttemptDetail[] = [];
const certificates: Certificate[] = [];
let certificateCounter = 0;

function currentUser(): User | undefined {
  return db.users.find((item) => item.id === db.CURRENT_USER_ID);
}

function requireUser(): User {
  const user = currentUser();
  if (!user) throw new ApiError('Требуется вход', 401);
  return user;
}

function isContentManager(user: User | undefined) {
  return user?.role === 'owner' || user?.role === 'admin';
}

function assertContentManager() {
  if (!isContentManager(currentUser())) throw new ApiError('Недостаточно прав', 403);
}

function courseOr404(courseId: ID): Course {
  return db.courses.find((item) => item.id === courseId) ?? notFound('Курс');
}

function assertCourseAccess(course: Course) {
  const user = currentUser();
  if (!canAccessCourse(course, user, db.courseAssignments, db.positions)) {
    throw new ApiError('Нет доступа к курсу', user ? 403 : 401);
  }
}

/** Уроки курса в порядке разделов, затем в порядке внутри раздела. */
function orderedLessons(courseId: ID): Lesson[] {
  const sectionOrder = new Map(
    db.courseSections
      .filter((section) => section.courseId === courseId)
      .map((section) => [section.id, section.order]),
  );
  return db.lessons
    .filter((lesson) => lesson.courseId === courseId)
    .slice()
    .sort((a, b) => {
      const sectionDiff = (sectionOrder.get(a.sectionId) ?? 0) - (sectionOrder.get(b.sectionId) ?? 0);
      return sectionDiff !== 0 ? sectionDiff : a.order - b.order;
    });
}

function progressFor(courseId: ID, userId: ID): CourseProgress | undefined {
  return db.courseProgress.find((item) => item.courseId === courseId && item.userId === userId);
}

function ensureProgress(courseId: ID, userId: ID): CourseProgress {
  const existing = progressFor(courseId, userId);
  if (existing) return existing;

  const created: CourseProgress = {
    userId,
    courseId,
    status: 'in_progress',
    completedLessonIds: [],
    quizAttempts: [],
    startedAt: now(),
  };
  db.courseProgress.push(created);
  return created;
}

/** Назначен ли курс человеку — с учётом должности и отдела. */
function isAssignedTo(courseId: ID, user: User): boolean {
  return expandAssignments(
    db.courseAssignments.filter((assignment) => assignment.courseId === courseId),
    [user],
    db.positions,
    db.courses,
  ).length > 0;
}

/**
 * Может ли человек проходить курс. Открытые для компании и публичные курсы
 * доступны без назначения, остальное — только адресатам.
 */
function assertCanLearn(course: Course, user: User) {
  if (isContentManager(user)) return;
  if (course.status !== 'published') throw new ApiError('Курс ещё не опубликован', 403);
  if (course.visibility === 'public' || course.visibility === 'company') return;
  if (!isAssignedTo(course.id, user)) throw new ApiError('Курс вам не назначен', 403);
}

function issueCertificate(courseId: ID, userId: ID): Certificate {
  const existing = certificates.find(
    (item) => item.courseId === courseId && item.userId === userId,
  );
  if (existing) return existing;

  certificateCounter += 1;
  const certificate: Certificate = {
    id: uid(),
    number: `TOS-${new Date().getFullYear()}-${String(certificateCounter).padStart(6, '0')}`,
    userId,
    courseId,
    issuedAt: now(),
  };
  certificates.push(certificate);
  return certificate;
}

/**
 * Пересчитывает статус курса после изменения прогресса и выдаёт сертификат
 * при полном прохождении.
 */
function refreshCourseCompletion(progress: CourseProgress) {
  const lessons = orderedLessons(progress.courseId);
  const done =
    lessons.length > 0 && lessons.every((lesson) => progress.completedLessonIds.includes(lesson.id));

  if (done) {
    progress.status = 'completed';
    progress.completedAt = progress.completedAt ?? now();
    issueCertificate(progress.courseId, progress.userId);
  } else {
    progress.status = 'in_progress';
    progress.completedAt = undefined;
  }
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const academyOpusApi = {
  // --- чтение каталога -----------------------------------------------------

  getCourses: (): Promise<Course[]> =>
    mockRequest(() => {
      const user = currentUser();
      return db.courses.filter((course) =>
        canAccessCourse(course, user, db.courseAssignments, db.positions),
      );
    }),

  getCourse: (courseId: ID): Promise<Course> =>
    mockRequest(() => {
      const course = courseOr404(courseId);
      assertCourseAccess(course);
      return course;
    }),

  getSections: (courseId: ID): Promise<CourseSection[]> =>
    mockRequest(() =>
      db.courseSections
        .filter((section) => section.courseId === courseId)
        .slice()
        .sort((a, b) => a.order - b.order),
    ),

  /** Уроки курса в порядке прохождения; без courseId — все доступные. */
  getLessons: (courseId?: ID): Promise<Lesson[]> =>
    mockRequest(() => {
      if (courseId) {
        assertCourseAccess(courseOr404(courseId));
        return orderedLessons(courseId);
      }
      const user = currentUser();
      const accessible = new Set(
        db.courses
          .filter((course) => canAccessCourse(course, user, db.courseAssignments, db.positions))
          .map((course) => course.id),
      );
      return db.lessons.filter((lesson) => accessible.has(lesson.courseId));
    }),

  getQuizzes: (): Promise<Quiz[]> => mockRequest(() => db.quizzes),

  getProgress: (courseId?: ID): Promise<CourseProgress[]> =>
    mockRequest(() =>
      courseId
        ? db.courseProgress.filter((item) => item.courseId === courseId)
        : db.courseProgress,
    ),

  // --- назначения ----------------------------------------------------------

  getAssignments: (): Promise<CourseAssignment[]> => mockRequest(() => db.courseAssignments),

  /**
   * Назначения текущего пользователя, развёрнутые из должностей и отделов.
   * Именно этого не хватало базовой Академии: там список не фильтровался
   * по человеку и показывал чужие назначения.
   */
  getMyAssignments: (): Promise<LearnerAssignment[]> =>
    mockRequest(
      () => {
        const user = currentUser();
        if (!user) return [];
        return expandAssignments(db.courseAssignments, [user], db.positions, db.courses);
      },
      { noFail: true },
    ),

  assignCourse: (input: {
    courseId: ID;
    assigneeType: CourseAssignment['assigneeType'];
    assigneeId?: ID;
    dueDate?: string;
  }): Promise<CourseAssignment> =>
    mockRequest(() => {
      assertContentManager();
      courseOr404(input.courseId);

      const assignment: CourseAssignment = {
        id: uid(),
        courseId: input.courseId,
        assigneeType: input.assigneeType,
        assigneeId: input.assigneeId || undefined,
        inviteToken: input.assigneeType === 'external' ? uid() : undefined,
        dueDate: input.dueDate || undefined,
        assignedById: db.CURRENT_USER_ID,
        createdAt: now(),
      };
      db.courseAssignments.push(assignment);
      return assignment;
    }),

  unassign: (assignmentId: ID): Promise<void> =>
    mockRequest(() => {
      assertContentManager();
      const index = db.courseAssignments.findIndex((item) => item.id === assignmentId);
      if (index === -1) notFound('Назначение');
      db.courseAssignments.splice(index, 1);
    }),

  /**
   * Досоздаёт назначения по обязательным курсам должностей
   * (Position.requiredCourseIds). Возвращает число созданных.
   */
  syncRequiredAssignments: (): Promise<number> =>
    mockRequest(() => {
      assertContentManager();
      const missing = missingRequiredAssignments(db.users, db.positions, db.courseAssignments);

      for (const item of missing) {
        db.courseAssignments.push({
          id: uid(),
          courseId: item.courseId,
          assigneeType: 'user',
          assigneeId: item.userId,
          assignedById: db.CURRENT_USER_ID,
          createdAt: now(),
        });
      }
      return missing.length;
    }),

  // --- отчётность ----------------------------------------------------------

  /**
   * Строки отчёта по всем назначенным, включая не начавших курс.
   * Базовая Академия строит таблицу из courseProgress и потому не видит тех,
   * кто ещё не открывал курс, — то есть не отвечает на главный вопрос отчёта.
   */
  getLearnerRows: (): Promise<LearnerRow[]> =>
    mockRequest(() => {
      assertContentManager();
      const assignments = expandAssignments(
        db.courseAssignments,
        db.users,
        db.positions,
        db.courses,
      );
      return buildLearnerRows(assignments, db.courseProgress, db.lessons, db.courses, new Date());
    }),

  /** Отсев по урокам курса — где учащиеся останавливаются. */
  getCourseDropOff: (
    courseId: ID,
  ): Promise<Array<{ lessonId: ID; title: string; completed: number }>> =>
    mockRequest(() => {
      assertContentManager();
      const assigned = new Set(
        expandAssignments(
          db.courseAssignments.filter((item) => item.courseId === courseId),
          db.users,
          db.positions,
          db.courses,
        ).map((item) => item.userId),
      );
      return lessonDropOff(orderedLessons(courseId), db.courseProgress, assigned);
    }),

  // --- прохождение ---------------------------------------------------------

  /**
   * Отправка попытки теста: балл считается на стороне API, а не в компоненте.
   * Урок засчитывается автоматически, если тест сдан.
   */
  submitQuizAttempt: (input: {
    courseId: ID;
    lessonId: ID;
    quizId: ID;
    answers: QuizAnswer[];
  }): Promise<{ grade: QuizGrade; attempt: QuizAttempt; progress: CourseProgress }> =>
    mockRequest(() => {
      const user = requireUser();
      const course = courseOr404(input.courseId);
      assertCanLearn(course, user);

      const quiz = db.quizzes.find((item) => item.id === input.quizId) ?? notFound('Тест');
      const progress = ensureProgress(input.courseId, user.id);
      const used = attemptsOf(progress.quizAttempts, quiz.id, user.id);

      if (!canAttempt(quiz, used)) throw new ApiError('Попытки исчерпаны', 409);

      const grade = gradeQuiz(quiz, input.answers);
      const attempt: QuizAttempt = {
        id: uid(),
        quizId: quiz.id,
        userId: user.id,
        score: grade.score,
        passed: grade.passed,
        pendingReview: grade.pendingReview,
        createdAt: now(),
      };
      progress.quizAttempts.push(attempt);

      attemptDetails.push({
        attemptId: attempt.id,
        quizId: quiz.id,
        courseId: input.courseId,
        lessonId: input.lessonId,
        userId: user.id,
        answers: input.answers,
        createdAt: attempt.createdAt,
      });

      if (grade.passed && !progress.completedLessonIds.includes(input.lessonId)) {
        progress.completedLessonIds.push(input.lessonId);
      }
      refreshCourseCompletion(progress);

      return { grade, attempt, progress };
    }),

  /**
   * Отметка урока пройденным с проверками на стороне API: назначение,
   * порядок при последовательном прохождении и сданный тест урока.
   */
  markLessonComplete: (input: { courseId: ID; lessonId: ID }): Promise<CourseProgress> =>
    mockRequest(() => {
      const user = requireUser();
      const course = courseOr404(input.courseId);
      assertCanLearn(course, user);

      const lessons = orderedLessons(input.courseId);
      const lesson = lessons.find((item) => item.id === input.lessonId) ?? notFound('Урок');
      const progress = ensureProgress(input.courseId, user.id);

      if (!isLessonUnlocked(lessons, progress, lesson.id, course.sequential)) {
        throw new ApiError('Сначала пройдите предыдущие уроки', 409);
      }

      if (lesson.quizId) {
        const passed = attemptsOf(progress.quizAttempts, lesson.quizId, user.id).some(
          (attempt) => attempt.passed,
        );
        if (!passed) throw new ApiError('Сначала сдайте тест урока', 409);
      }

      if (!progress.completedLessonIds.includes(lesson.id)) {
        progress.completedLessonIds.push(lesson.id);
      }
      refreshCourseCompletion(progress);
      return progress;
    }),

  // --- ручная проверка -----------------------------------------------------

  /** Очередь открытых ответов, ждущих вердикта проверяющего. */
  getReviewQueue: (): Promise<ReviewQueueItem[]> =>
    mockRequest(() => {
      assertContentManager();
      const pendingIds = new Set(
        db.courseProgress
          .flatMap((progress) => progress.quizAttempts)
          .filter((attempt) => attempt.pendingReview)
          .map((attempt) => attempt.id),
      );

      return attemptDetails
        .filter((detail) => pendingIds.has(detail.attemptId))
        .map((detail) => ({
          detail,
          courseTitle: db.courses.find((course) => course.id === detail.courseId)?.title ?? '—',
          lessonTitle: db.lessons.find((lesson) => lesson.id === detail.lessonId)?.title ?? '—',
          userId: detail.userId,
        }));
    }),

  /** Развёрнутая попытка — чтобы показать ответы в разборе и при проверке. */
  getAttemptDetail: (attemptId: ID): Promise<QuizAttemptDetail> =>
    mockRequest(
      () => attemptDetails.find((detail) => detail.attemptId === attemptId) ?? notFound('Попытка'),
    ),

  /**
   * Вердикт по открытым вопросам. Балл пересчитывается с учётом проверки,
   * и при успехе урок засчитывается.
   */
  reviewAttempt: (input: {
    attemptId: ID;
    openReview: Record<ID, boolean>;
    comment?: string;
  }): Promise<QuizAttempt> =>
    mockRequest(() => {
      assertContentManager();

      const detail =
        attemptDetails.find((item) => item.attemptId === input.attemptId) ?? notFound('Попытка');
      const progress =
        progressFor(detail.courseId, detail.userId) ?? notFound('Прогресс');
      const attempt =
        progress.quizAttempts.find((item) => item.id === input.attemptId) ?? notFound('Попытка');
      const quiz = db.quizzes.find((item) => item.id === detail.quizId) ?? notFound('Тест');

      const grade = gradeWithReview(quiz, detail.answers, input.openReview);
      attempt.score = grade.score;
      attempt.passed = grade.passed;
      attempt.pendingReview = false;

      detail.openReview = input.openReview;
      detail.reviewerId = db.CURRENT_USER_ID;
      detail.reviewComment = input.comment;
      detail.reviewedAt = now();

      if (grade.passed && !progress.completedLessonIds.includes(detail.lessonId)) {
        progress.completedLessonIds.push(detail.lessonId);
      }
      refreshCourseCompletion(progress);

      return attempt;
    }),

  // --- сертификаты ---------------------------------------------------------

  getCertificates: (): Promise<Certificate[]> =>
    mockRequest(() => {
      const user = currentUser();
      if (isContentManager(user)) return certificates;
      return certificates.filter((item) => item.userId === user?.id);
    }, { noFail: true }),

  // --- редактирование ------------------------------------------------------

  updateCourse: (input: {
    id: ID;
    title?: string;
    description?: string;
    status?: Course['status'];
    visibility?: Course['visibility'];
    sequential?: boolean;
    deadlineDays?: number;
  }): Promise<Course> =>
    mockRequest(() => {
      assertContentManager();
      const course = courseOr404(input.id);

      if (input.status === 'published' && orderedLessons(course.id).length === 0) {
        throw new ApiError('Нельзя опубликовать курс без уроков', 400);
      }

      if (input.title !== undefined) course.title = input.title;
      if (input.description !== undefined) course.description = input.description || undefined;
      if (input.status !== undefined) course.status = input.status;
      if (input.visibility !== undefined) course.visibility = input.visibility;
      if (input.sequential !== undefined) course.sequential = input.sequential;
      if (input.deadlineDays !== undefined) {
        course.deadlineDays = input.deadlineDays > 0 ? input.deadlineDays : undefined;
      }
      course.updatedAt = now();
      return course;
    }),

  upsertQuiz: (input: Omit<Quiz, 'id'> & { id?: ID }): Promise<Quiz> =>
    mockRequest(() => {
      assertContentManager();

      const existing = input.id ? db.quizzes.find((item) => item.id === input.id) : undefined;
      if (existing) {
        existing.questions = input.questions;
        existing.passingScore = input.passingScore;
        existing.maxAttempts = input.maxAttempts;
        return existing;
      }

      const quiz: Quiz = { ...input, id: input.id ?? uid() };
      db.quizzes.push(quiz);
      const lesson = db.lessons.find((item) => item.id === quiz.lessonId);
      if (lesson) lesson.quizId = quiz.id;
      return quiz;
    }),

  /** Срок действия назначения курса, посчитанный на стороне API. */
  dueDateFor: (assignment: CourseAssignment) =>
    resolveDueDate(
      assignment,
      db.courses.find((course) => course.id === assignment.courseId),
    ),
};
