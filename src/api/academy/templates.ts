import type {
  AcademyCourseDetail,
  AcademyTemplateSummary,
  CourseVersionAuthorDetail,
  PaginatedResult,
} from '@/types/academy';
import type { ID } from '@/types';
import { academyGet, academyMutate, buildQuery, encodeId, type RequestOptions } from './httpHelpers';

/** Backend-plan §11.5 */
export const academyTemplatesApi = {
  list(
    filters: { q?: string; ownerType?: string; page?: number; pageSize?: number } = {},
    options?: RequestOptions,
  ): Promise<PaginatedResult<AcademyTemplateSummary>> {
    return academyGet(
      `/academy/templates${buildQuery({
        q: filters.q,
        ownerType: filters.ownerType,
        page: filters.page,
        pageSize: filters.pageSize,
      })}`,
      options,
    );
  },

  get(templateId: ID, options?: RequestOptions): Promise<AcademyTemplateSummary> {
    return academyGet(`/academy/templates/${encodeId(templateId)}`, options);
  },

  getPreview(templateId: ID, options?: RequestOptions): Promise<CourseVersionAuthorDetail> {
    return academyGet(`/academy/templates/${encodeId(templateId)}/preview`, options);
  },

  /** Instantiate a published template version into an independent course draft. */
  instantiate(
    templateVersionId: ID,
    input: { title?: string } = {},
    options?: RequestOptions,
  ): Promise<AcademyCourseDetail> {
    return academyMutate(
      `/academy/template-versions/${encodeId(templateVersionId)}/instantiate`,
      'POST',
      input,
      options,
    );
  },

  archive(templateId: ID, options?: RequestOptions): Promise<AcademyTemplateSummary> {
    return academyMutate(
      `/academy/templates/${encodeId(templateId)}/archive`,
      'POST',
      {},
      options,
    );
  },
};
