import type {
  AcademyCourseDetail,
  AcademyCourseSummary,
  AcademyListFilters,
  CourseVersionAuthorDetail,
  PaginatedResult,
} from '@/types/academy';
import type { ID } from '@/types';
import { academyGet, academyMutate, buildQuery, encodeId, type RequestOptions } from './httpHelpers';

export type CreateCourseInput = {
  title: string;
  description?: string;
  sequential?: boolean;
  deadlineDays?: number;
  visibility?: 'public' | 'company' | 'restricted';
  templateId?: ID;
  templateVersionId?: ID;
};

export type UpdateCourseInput = {
  title?: string;
  description?: string;
  sequential?: boolean;
  deadlineDays?: number;
  visibility?: 'public' | 'company' | 'restricted';
  coverUrl?: string | null;
};

/**
 * Paths aligned with teamos-academy-backend-plan §11.1–11.4.
 * Base: /api/v1 (API_URL) + /academy/...
 */
export const academyCoursesApi = {
  list(
    filters: AcademyListFilters = {},
    options?: RequestOptions,
  ): Promise<PaginatedResult<AcademyCourseSummary>> {
    return academyGet(
      `/academy/courses${buildQuery({
        q: filters.q,
        lifecycle: filters.lifecycleStatus === 'all' ? undefined : filters.lifecycleStatus,
        distribution:
          filters.distributionStatus === 'all' ? undefined : filters.distributionStatus,
        ownerType: filters.ownerType === 'all' ? undefined : filters.ownerType,
        page: filters.page,
        pageSize: filters.pageSize,
        sort: filters.sort,
      })}`,
      options,
    );
  },

  get(courseId: ID, options?: RequestOptions): Promise<AcademyCourseDetail> {
    return academyGet(`/academy/courses/${encodeId(courseId)}`, options);
  },

  create(input: CreateCourseInput, options?: RequestOptions): Promise<AcademyCourseDetail> {
    // Server sets owner type from role — body must not spoof owner.
    return academyMutate('/academy/courses', 'POST', input, options);
  },

  /** Patch draft metadata on the course. */
  update(
    courseId: ID,
    input: UpdateCourseInput,
    options?: RequestOptions,
  ): Promise<AcademyCourseDetail> {
    return academyMutate(`/academy/courses/${encodeId(courseId)}/draft`, 'PATCH', input, options);
  },

  archive(courseId: ID, options?: RequestOptions): Promise<AcademyCourseDetail> {
    return academyMutate(`/academy/courses/${encodeId(courseId)}/archive`, 'POST', {}, options);
  },

  restore(courseId: ID, options?: RequestOptions): Promise<AcademyCourseDetail> {
    return academyMutate(`/academy/courses/${encodeId(courseId)}/restore`, 'POST', {}, options);
  },

  delete(courseId: ID, options?: RequestOptions): Promise<void> {
    return academyMutate(`/academy/courses/${encodeId(courseId)}`, 'DELETE', undefined, options);
  },

  pauseDistribution(
    courseId: ID,
    input: { reason: string },
    options?: RequestOptions,
  ): Promise<AcademyCourseDetail> {
    return academyMutate(
      `/academy/courses/${encodeId(courseId)}/restrictions/pause`,
      'POST',
      input,
      options,
    );
  },

  block(
    courseId: ID,
    input: { reason: string },
    options?: RequestOptions,
  ): Promise<AcademyCourseDetail> {
    return academyMutate(
      `/academy/courses/${encodeId(courseId)}/restrictions/block`,
      'POST',
      input,
      options,
    );
  },

  resolveRestriction(courseId: ID, options?: RequestOptions): Promise<AcademyCourseDetail> {
    return academyMutate(
      `/academy/courses/${encodeId(courseId)}/restrictions/resolve`,
      'POST',
      {},
      options,
    );
  },

  copyToCompany(
    courseId: ID,
    input: { versionId: ID },
    options?: RequestOptions,
  ): Promise<AcademyCourseDetail> {
    return academyMutate(
      `/academy/partner-courses/${encodeId(courseId)}/versions/${encodeId(input.versionId)}/copy-to-company`,
      'POST',
      {},
      options,
    );
  },

  getDraft(courseId: ID, options?: RequestOptions): Promise<CourseVersionAuthorDetail> {
    return academyGet(`/academy/courses/${encodeId(courseId)}/draft`, options);
  },

  /** Ensure draft exists (backend may create version 1). */
  ensureDraft(courseId: ID, options?: RequestOptions): Promise<CourseVersionAuthorDetail> {
    return academyMutate(`/academy/courses/${encodeId(courseId)}/draft`, 'POST', {}, options);
  },
};
