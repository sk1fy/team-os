import type {
  AcademyCourseDetail,
  AcademyCourseSummary,
  AcademyListFilters,
  CourseVersionSummary,
  CourseVersionAuthorDetail,
  PaginatedResult,
} from '@/types/academy';
import type { ID } from '@/types';
import {
  academyGet,
  academyMutate,
  buildQuery,
  encodeId,
  type RequestOptions,
} from './httpHelpers';

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

type CourseWire = Partial<AcademyCourseDetail> & {
  id: ID;
  title: string;
  authorId?: ID;
  currentDraftVersionId?: ID;
  latestPublishedVersionId?: ID;
};

function versionSummary(
  course: CourseWire,
  id: ID | undefined,
  status: CourseVersionSummary['status'],
): CourseVersionSummary | undefined {
  if (!id) return undefined;
  return {
    id,
    courseId: course.id,
    versionNumber: 1,
    status,
    title: course.title,
    createdAt: course.createdAt ?? course.updatedAt ?? '',
    updatedAt: course.updatedAt ?? course.createdAt ?? '',
  };
}

export function normalizeCourse(course: CourseWire): AcademyCourseDetail {
  return {
    ...course,
    id: course.id,
    ownerType: course.ownerType === 'partner' ? 'partner' : 'company',
    ownerUserId: course.ownerUserId ?? course.authorId,
    title: course.title,
    lifecycleStatus:
      course.lifecycleStatus === 'archived' || course.lifecycleStatus === 'deleted'
        ? course.lifecycleStatus
        : 'active',
    distributionStatus:
      course.distributionStatus === 'paused' || course.distributionStatus === 'blocked'
        ? course.distributionStatus
        : 'active',
    latestPublishedVersion:
      course.latestPublishedVersion ??
      versionSummary(course, course.latestPublishedVersionId, 'published'),
    draftVersion:
      course.draftVersion ?? versionSummary(course, course.currentDraftVersionId, 'draft'),
    capabilities: course.capabilities,
    sequential: course.sequential !== false,
    visibility:
      course.visibility === 'public' || course.visibility === 'company'
        ? course.visibility
        : 'restricted',
    createdAt: course.createdAt ?? '',
    updatedAt: course.updatedAt ?? course.createdAt ?? '',
  };
}

function normalizeDraft(draft: CourseVersionAuthorDetail): CourseVersionAuthorDetail {
  return {
    ...draft,
    sections: (draft.sections ?? []).map((section) => ({
      ...section,
      lessons: Array.isArray(section.lessons) ? section.lessons : [],
    })),
  };
}

/**
 * Paths aligned with teamos-academy-backend-plan §11.1–11.4.
 * Base: /api/v1 (API_URL) + /academy/...
 */
export const academyCoursesApi = {
  async list(
    filters: AcademyListFilters = {},
    options?: RequestOptions,
  ): Promise<PaginatedResult<AcademyCourseSummary>> {
    const payload = await academyGet<PaginatedResult<CourseWire> | CourseWire[]>(
      `/academy/courses${buildQuery({
        q: filters.q,
        lifecycle: filters.lifecycleStatus === 'all' ? undefined : filters.lifecycleStatus,
        distribution: filters.distributionStatus === 'all' ? undefined : filters.distributionStatus,
        ownerType: filters.ownerType === 'all' ? undefined : filters.ownerType,
        page: filters.page,
        pageSize: filters.pageSize,
        sort: filters.sort,
      })}`,
      options,
    );
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 30;
    if (Array.isArray(payload)) {
      return {
        items: payload.map(normalizeCourse),
        page,
        pageSize,
        total: payload.length,
        totalPages: Math.max(1, Math.ceil(payload.length / pageSize)),
      };
    }
    return {
      ...payload,
      items: (payload.items ?? []).map(normalizeCourse),
      page: payload.page || page,
      pageSize: payload.pageSize || pageSize,
      total: payload.total ?? payload.items?.length ?? 0,
      totalPages: payload.totalPages || 1,
    };
  },

  async get(courseId: ID, options?: RequestOptions): Promise<AcademyCourseDetail> {
    return normalizeCourse(
      await academyGet<CourseWire>(`/academy/courses/${encodeId(courseId)}`, options),
    );
  },

  async create(input: CreateCourseInput, options?: RequestOptions): Promise<AcademyCourseDetail> {
    // Server sets owner type from role — body must not spoof owner.
    return normalizeCourse(
      await academyMutate<CourseWire>('/academy/courses', 'POST', input, options),
    );
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

  async getDraft(courseId: ID, options?: RequestOptions): Promise<CourseVersionAuthorDetail> {
    return normalizeDraft(
      await academyGet<CourseVersionAuthorDetail>(
        `/academy/courses/${encodeId(courseId)}/draft`,
        options,
      ),
    );
  },

  /** Ensure draft exists (backend may create version 1). */
  async ensureDraft(courseId: ID, options?: RequestOptions): Promise<CourseVersionAuthorDetail> {
    return normalizeDraft(
      await academyMutate<CourseVersionAuthorDetail>(
        `/academy/courses/${encodeId(courseId)}/draft`,
        'POST',
        {},
        options,
      ),
    );
  },
};
