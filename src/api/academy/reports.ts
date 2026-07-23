import type { EnrollmentReport } from '@/types/academyExternal';
import type {
  AcademyCourseSummary,
  InternalReportResult,
  PaginatedResult,
  QuizAttemptResult,
} from '@/types/academy';
import type { ID } from '@/types';
import type { InternalReportFilters } from '@/lib/academy/reportFilters';
import { academyLearningApi, normalizeEnrollmentSummary, type EnrollmentWire } from './learning';
import {
  academyDownload,
  academyGet,
  buildQuery,
  encodeId,
  type RequestOptions,
} from './httpHelpers';

/** Partner-scoped external report row (server-filtered). */
export type PartnerExternalReportRow = {
  enrollmentId: ID;
  courseId: ID;
  courseTitle: string;
  learnerEmail: string;
  learnerName?: string;
  progressStatus: string;
  accessStatus: string;
  percent: number;
  activatedAt?: string;
  completedAt?: string;
};

type EnrollmentReportWire = {
  enrollment?: EnrollmentWire;
  lessonResults?: EnrollmentReport['lessonResults'];
  lessons?: Array<{
    lessonId?: ID;
    lessonVersionId?: ID;
    title?: string;
    status?: string;
    completed?: boolean;
    completedAt?: string;
    quizScore?: number;
    quizPassed?: boolean;
  }>;
  quizAttempts?: QuizAttemptResult[];
  learnerEmail?: string;
  learnerName?: string;
};

export const academyReportsApi = {
  /** Owner/admin internal employee report — never for partner role in UI. */
  internal(
    filters: InternalReportFilters = {},
    options?: RequestOptions,
  ): Promise<InternalReportResult> {
    return academyGet(
      `/academy/reports/internal${buildQuery({
        q: filters.q,
        courseId: filters.courseId,
        departmentId: filters.departmentId,
        positionId: filters.positionId,
        status: filters.status,
        page: filters.page,
        pageSize: filters.pageSize,
        sort: filters.sort,
      })}`,
      options,
    );
  },

  /**
   * Partner external activity — backend scopes to own courses.
   * Prefer this over reports/internal for role=partner.
   */
  partnerExternal(
    filters: { q?: string; courseId?: string; page?: number; pageSize?: number } = {},
    options?: RequestOptions,
  ): Promise<PaginatedResult<PartnerExternalReportRow>> {
    return academyGet(
      `/academy/reports/external${buildQuery({
        q: filters.q,
        courseId: filters.courseId,
        page: filters.page,
        pageSize: filters.pageSize,
      })}`,
      options,
    );
  },

  async enrollment(enrollmentId: ID, options?: RequestOptions): Promise<EnrollmentReport> {
    const [payload, detail] = await Promise.all([
      academyGet<EnrollmentReportWire>(
        `/academy/enrollments/${encodeId(enrollmentId)}/report`,
        options,
      ),
      academyLearningApi.getEnrollment(enrollmentId, options).catch(() => null),
    ]);
    const titleByLessonId = new Map(
      (detail?.outline.sections ?? []).flatMap((section) =>
        section.lessons.map((lesson) => [lesson.id, lesson.title] as const),
      ),
    );
    const orderByLessonId = new Map(
      (detail?.outline.sections ?? [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .flatMap((section) => section.lessons.slice().sort((a, b) => a.order - b.order))
        .map((lesson, index) => [lesson.id, index] as const),
    );
    const rawLessonResults = Array.isArray(payload.lessonResults)
      ? payload.lessonResults
      : (payload.lessons ?? []).map((lesson, index) => {
          const lessonId = lesson.lessonId ?? lesson.lessonVersionId ?? `lesson-${index + 1}`;
          return {
            lessonId,
            title: lesson.title ?? titleByLessonId.get(lessonId) ?? `Урок ${index + 1}`,
            completed: lesson.completed === true || lesson.status === 'completed',
            completedAt: lesson.completedAt,
            quizScore: lesson.quizScore,
            quizPassed: lesson.quizPassed,
          };
        });
    const lessonResults = rawLessonResults
      .slice()
      .sort(
        (a, b) =>
          (orderByLessonId.get(a.lessonId) ?? Number.MAX_SAFE_INTEGER) -
          (orderByLessonId.get(b.lessonId) ?? Number.MAX_SAFE_INTEGER),
      );
    const enrollment =
      detail ??
      (payload.enrollment
        ? normalizeEnrollmentSummary(payload.enrollment, {
            completedLessons: lessonResults.filter((lesson) => lesson.completed).length,
            totalLessons: lessonResults.length,
          })
        : normalizeEnrollmentSummary(
            {
              id: enrollmentId,
              courseId: '',
              courseVersionId: '',
            },
            { totalLessons: lessonResults.length },
          ));

    return {
      enrollment,
      lessonResults,
      quizAttempts: Array.isArray(payload.quizAttempts) ? payload.quizAttempts : [],
      learnerEmail: payload.learnerEmail,
      learnerName: payload.learnerName,
    };
  },

  /** Backend-plan §11.9: server-scoped partner course overview. */
  partnerCourses(
    partnerId: ID,
    filters: { page?: number; pageSize?: number } = {},
    options?: RequestOptions,
  ): Promise<PaginatedResult<AcademyCourseSummary>> {
    return academyGet(
      `/academy/partners/${encodeId(partnerId)}/courses-report${buildQuery(filters)}`,
      options,
    );
  },

  internalCsv(filters: InternalReportFilters = {}, options?: RequestOptions): Promise<Blob> {
    return academyDownload(
      `/academy/reports/internal/export${buildQuery({
        q: filters.q,
        courseId: filters.courseId,
        departmentId: filters.departmentId,
        positionId: filters.positionId,
        status: filters.status,
        sort: filters.sort,
      })}`,
      options,
    );
  },
};
