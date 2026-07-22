import type { AcademyTemplateSummary, CourseVersionAuthorDetail, PaginatedResult } from '@/types/academy';
import type { AcademyCourseDetail } from '@/types/academy';
import type { ID } from '@/types';
import { academyGet, academyMutate, buildQuery, encodeId, type RequestOptions } from './httpHelpers';

export const academyTemplatesApi = {
  list(
    filters: { q?: string; ownerType?: string; page?: number; pageSize?: number } = {},
    options?: RequestOptions,
  ): Promise<PaginatedResult<AcademyTemplateSummary>> {
    return academyGet(
      `/academy/v2/templates${buildQuery({
        q: filters.q,
        ownerType: filters.ownerType,
        page: filters.page,
        pageSize: filters.pageSize,
      })}`,
      options,
    );
  },

  get(templateId: ID, options?: RequestOptions): Promise<AcademyTemplateSummary> {
    return academyGet(`/academy/v2/templates/${encodeId(templateId)}`, options);
  },

  getPreview(templateId: ID, options?: RequestOptions): Promise<CourseVersionAuthorDetail> {
    return academyGet(`/academy/v2/templates/${encodeId(templateId)}/preview`, options);
  },

  instantiate(
    templateId: ID,
    input: { title?: string } = {},
    options?: RequestOptions,
  ): Promise<AcademyCourseDetail> {
    return academyMutate(
      `/academy/v2/templates/${encodeId(templateId)}/instantiate`,
      'POST',
      input,
      options,
    );
  },

  archive(templateId: ID, options?: RequestOptions): Promise<AcademyTemplateSummary> {
    return academyMutate(
      `/academy/v2/templates/${encodeId(templateId)}/archive`,
      'POST',
      {},
      options,
    );
  },
};
