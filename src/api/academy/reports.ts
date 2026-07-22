import type { EnrollmentReport } from '@/types/academyExternal';
import type { InternalReportResult } from '@/types/academy';
import type { ID } from '@/types';
import type { InternalReportFilters } from '@/lib/academy/reportFilters';
import { academyGet, buildQuery, encodeId, type RequestOptions } from './httpHelpers';

export const academyReportsApi = {
  internal(
    filters: InternalReportFilters = {},
    options?: RequestOptions,
  ): Promise<InternalReportResult> {
    return academyGet(
      `/academy/v2/reports/internal${buildQuery({
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

  enrollment(enrollmentId: ID, options?: RequestOptions): Promise<EnrollmentReport> {
    return academyGet(`/academy/v2/enrollments/${encodeId(enrollmentId)}/report`, options);
  },

  /** Returns CSV blob URL path — caller downloads via authenticated fetch. */
  internalCsvPath(filters: InternalReportFilters = {}): string {
    return `/academy/v2/reports/internal/export${buildQuery({
      q: filters.q,
      courseId: filters.courseId,
      departmentId: filters.departmentId,
      positionId: filters.positionId,
      status: filters.status,
      sort: filters.sort,
    })}`;
  },
};
