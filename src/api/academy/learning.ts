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

export const academyLearningApi = {
  myLearning(options?: RequestOptions): Promise<MyLearningSummary> {
    return academyGet('/academy/v2/my-learning', options);
  },

  myEnrollments(
    filters: { status?: string; page?: number; pageSize?: number } = {},
    options?: RequestOptions,
  ): Promise<PaginatedResult<EnrollmentSummary>> {
    return academyGet(
      `/academy/v2/enrollments/me${buildQuery({
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
      `/academy/v2/catalog${buildQuery({
        q: filters.q,
        page: filters.page,
        pageSize: filters.pageSize,
      })}`,
      options,
    );
  },

  getEnrollment(enrollmentId: ID, options?: RequestOptions): Promise<EnrollmentDetail> {
    return academyGet(`/academy/v2/enrollments/${encodeId(enrollmentId)}`, options);
  },

  getLesson(
    enrollmentId: ID,
    lessonId: ID,
    options?: RequestOptions,
  ): Promise<LessonLearner> {
    return academyGet(
      `/academy/v2/enrollments/${encodeId(enrollmentId)}/lessons/${encodeId(lessonId)}`,
      options,
    );
  },

  completeLesson(
    enrollmentId: ID,
    lessonId: ID,
    options?: RequestOptions,
  ): Promise<EnrollmentDetail> {
    return academyMutate(
      `/academy/v2/enrollments/${encodeId(enrollmentId)}/lessons/${encodeId(lessonId)}/complete`,
      'POST',
      {},
      options,
    );
  },

  submitQuiz(
    enrollmentId: ID,
    quizId: ID,
    input: { answers: QuizAttemptAnswer[] },
    options?: RequestOptions,
  ): Promise<QuizAttemptResult> {
    return academyMutate(
      `/academy/v2/enrollments/${encodeId(enrollmentId)}/quizzes/${encodeId(quizId)}/attempts`,
      'POST',
      input,
      options,
    );
  },

  enrollFromCatalog(courseId: ID, options?: RequestOptions): Promise<EnrollmentSummary> {
    return academyMutate(
      `/academy/v2/catalog/${encodeId(courseId)}/enroll`,
      'POST',
      {},
      options,
    );
  },

  /** Resolve active enrollment for legacy /learn/:courseId URLs. */
  resolveEnrollmentForCourse(
    courseId: ID,
    options?: RequestOptions,
  ): Promise<{ enrollmentId: ID }> {
    return academyGet(`/academy/v2/courses/${encodeId(courseId)}/my-enrollment`, options);
  },
};
