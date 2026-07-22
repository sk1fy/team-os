import type { EnrollmentReport } from '@/types/academyExternal';
import type { AcademyCourseSummary, InternalReportResult, PaginatedResult } from '@/types/academy';
import type { ID } from '@/types';
import type { InternalReportFilters } from '@/lib/academy/reportFilters';
import { academyGet, buildQuery, encodeId, type RequestOptions } from './httpHelpers';

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

  enrollment(enrollmentId: ID, options?: RequestOptions): Promise<EnrollmentReport> {
    return academyGet(`/academy/enrollments/${encodeId(enrollmentId)}/report`, options);
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

  internalCsvPath(filters: InternalReportFilters = {}): string {
    return `/academy/reports/internal/export${buildQuery({
      q: filters.q,
      courseId: filters.courseId,
      departmentId: filters.departmentId,
      positionId: filters.positionId,
      status: filters.status,
      sort: filters.sort,
    })}`;
  },
};
