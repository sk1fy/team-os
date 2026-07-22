import type {
  CatalogCourseCard,
  EnrollmentDetail,
  EnrollmentSummary,
  LessonLearner,
  MyLearningSummary,
  PaginatedResult,
  QuizAttemptAnswer,
  QuizAttemptResult,
} from '@/types/academy';
import type { ID } from '@/types';
import { academyGet, academyMutate, buildQuery, encodeId, type RequestOptions } from './httpHelpers';

/** Atomic quiz grade payload — attempt + enrollment progress in one response. */
export type QuizSubmitResponse = {
  attempt: QuizAttemptResult;
  enrollment: EnrollmentDetail;
};

export const academyLearningApi = {
  myLearning(options?: RequestOptions): Promise<MyLearningSummary> {
    return academyGet('/academy/learning/me', options);
  },

  myEnrollments(
    filters: { status?: string; page?: number; pageSize?: number } = {},
    options?: RequestOptions,
  ): Promise<PaginatedResult<EnrollmentSummary>> {
    return academyGet(
      `/academy/enrollments/me${buildQuery({
        status: filters.status,
        page: filters.page,
        pageSize: filters.pageSize,
      })}`,
      options,
    );
  },

  catalog(
    filters: { q?: string; page?: number; pageSize?: number } = {},
    options?: RequestOptions,
  ): Promise<PaginatedResult<CatalogCourseCard>> {
    return academyGet(
      `/academy/catalog${buildQuery({
        q: filters.q,
        page: filters.page,
        pageSize: filters.pageSize,
      })}`,
      options,
    );
  },

  getEnrollment(enrollmentId: ID, options?: RequestOptions): Promise<EnrollmentDetail> {
    return academyGet(`/academy/enrollments/${encodeId(enrollmentId)}`, options);
  },

  getLesson(
    enrollmentId: ID,
    lessonId: ID,
    options?: RequestOptions,
  ): Promise<LessonLearner> {
    return academyGet(
      `/academy/enrollments/${encodeId(enrollmentId)}/lessons/${encodeId(lessonId)}`,
      options,
    );
  },

  completeLesson(
    enrollmentId: ID,
    lessonId: ID,
    options?: RequestOptions,
  ): Promise<EnrollmentDetail> {
    return academyMutate(
      `/academy/enrollments/${encodeId(enrollmentId)}/lessons/${encodeId(lessonId)}/complete`,
      'POST',
      {},
      options,
    );
  },

  /**
   * Server grades the attempt and atomically updates lesson completion / unlock.
   * Do not call completeLesson separately after a passed quiz.
   */
  submitQuiz(
    enrollmentId: ID,
    quizId: ID,
    input: { answers: QuizAttemptAnswer[] },
    options?: RequestOptions,
  ): Promise<QuizSubmitResponse> {
    return academyMutate(
      `/academy/enrollments/${encodeId(enrollmentId)}/quizzes/${encodeId(quizId)}/attempts`,
      'POST',
      input,
      options,
    );
  },

  enrollFromCatalog(courseId: ID, options?: RequestOptions): Promise<EnrollmentSummary> {
    return academyMutate(`/academy/catalog/${encodeId(courseId)}/enroll`, 'POST', {}, options);
  },

  /** Resolve active enrollment for legacy /learn/:courseId URLs. */
  resolveEnrollmentForCourse(
    courseId: ID,
    options?: RequestOptions,
  ): Promise<{ enrollmentId: ID }> {
    return academyGet(`/academy/courses/${encodeId(courseId)}/my-enrollment`, options);
  },
};
