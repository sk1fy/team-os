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
  ownerType?: 'company' | 'partner';
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

export const academyCoursesApi = {
  list(
    filters: AcademyListFilters = {},
    options?: RequestOptions,
  ): Promise<PaginatedResult<AcademyCourseSummary>> {
    return academyGet(
      `/academy/v2/courses${buildQuery({
        q: filters.q,
        lifecycleStatus: filters.lifecycleStatus === 'all' ? undefined : filters.lifecycleStatus,
        distributionStatus:
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
    return academyGet(`/academy/v2/courses/${encodeId(courseId)}`, options);
  },

  create(input: CreateCourseInput, options?: RequestOptions): Promise<AcademyCourseDetail> {
    return academyMutate('/academy/v2/courses', 'POST', input, options);
  },

  update(
    courseId: ID,
    input: UpdateCourseInput,
    options?: RequestOptions,
  ): Promise<AcademyCourseDetail> {
    return academyMutate(`/academy/v2/courses/${encodeId(courseId)}`, 'PATCH', input, options);
  },

  archive(courseId: ID, options?: RequestOptions): Promise<AcademyCourseDetail> {
    return academyMutate(`/academy/v2/courses/${encodeId(courseId)}/archive`, 'POST', {}, options);
  },

  restore(courseId: ID, options?: RequestOptions): Promise<AcademyCourseDetail> {
    return academyMutate(`/academy/v2/courses/${encodeId(courseId)}/restore`, 'POST', {}, options);
  },

  delete(courseId: ID, options?: RequestOptions): Promise<void> {
    return academyMutate(`/academy/v2/courses/${encodeId(courseId)}`, 'DELETE', undefined, options);
  },

  pauseDistribution(
    courseId: ID,
    input: { reason: string },
    options?: RequestOptions,
  ): Promise<AcademyCourseDetail> {
    return academyMutate(
      `/academy/v2/courses/${encodeId(courseId)}/pause`,
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
      `/academy/v2/courses/${encodeId(courseId)}/block`,
      'POST',
      input,
      options,
    );
  },

  resolveRestriction(courseId: ID, options?: RequestOptions): Promise<AcademyCourseDetail> {
    return academyMutate(
      `/academy/v2/courses/${encodeId(courseId)}/resolve-restriction`,
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
      `/academy/v2/courses/${encodeId(courseId)}/copy-to-company`,
      'POST',
      input,
      options,
    );
  },

  getDraft(courseId: ID, options?: RequestOptions): Promise<CourseVersionAuthorDetail> {
    return academyGet(`/academy/v2/courses/${encodeId(courseId)}/draft`, options);
  },
};
