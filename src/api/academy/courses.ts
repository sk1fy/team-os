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

export type CoursePartnerAudienceKind = 'none' | 'all_partners' | 'selected_partners';

export type CoursePartnerAudience = {
  audience: CoursePartnerAudienceKind;
  partnerUserIds: ID[];
};

export type SetCoursePartnerAudienceInput = {
  audience: CoursePartnerAudienceKind;
  partnerUserIds?: ID[];
};

type CourseWire = Partial<AcademyCourseDetail> & {
  id?: ID;
  title?: string;
  authorId?: ID;
  currentDraftVersionId?: ID;
  latestPublishedVersionId?: ID;
  versions?: Array<
    Partial<CourseVersionSummary> & {
      id: ID;
      number?: number;
    }
  >;
};

export type CourseCreationResult = {
  course: AcademyCourseDetail;
  draft?: CourseVersionAuthorDetail;
};

type CourseCreationWire =
  | CourseWire
  | {
      course: CourseWire;
      draft?: CourseVersionAuthorDetail;
    };

function versionSummary(
  course: CourseWire,
  id: ID | undefined,
  status: CourseVersionSummary['status'],
): CourseVersionSummary | undefined {
  if (!id) return undefined;
  const version = course.versions?.find((candidate) => candidate.id === id);
  return {
    ...version,
    id,
    courseId: version?.courseId ?? course.id ?? '',
    versionNumber: version?.versionNumber ?? version?.number ?? 1,
    status,
    title: version?.title ?? course.title ?? 'Курс',
    createdAt: course.createdAt ?? course.updatedAt ?? '',
    updatedAt: course.updatedAt ?? course.createdAt ?? '',
  };
}

function normalizeVersionReference(
  course: CourseWire,
  version:
    | CourseVersionSummary
    | (Partial<CourseVersionSummary> & { id: ID; number?: number })
    | undefined,
  status: CourseVersionSummary['status'],
): CourseVersionSummary | undefined {
  if (!version) return undefined;
  return {
    ...version,
    id: version.id,
    courseId: version.courseId ?? course.id ?? '',
    versionNumber:
      version.versionNumber ??
      ('number' in version && typeof version.number === 'number' ? version.number : 1),
    status: version.status ?? status,
    title: version.title ?? course.title ?? 'Курс',
    createdAt: version.createdAt ?? course.createdAt ?? course.updatedAt ?? '',
    updatedAt: version.updatedAt ?? course.updatedAt ?? course.createdAt ?? '',
  };
}

export function normalizeCourse(course: CourseWire): AcademyCourseDetail {
  const draftVersion =
    course.draftVersion ??
    course.versions?.find((version) => version.status === 'draft') ??
    versionSummary(course, course.currentDraftVersionId, 'draft');
  const latestPublishedVersion =
    course.latestPublishedVersion ??
    course.versions
      ?.filter((version) => version.status === 'published')
      .sort((a, b) => (b.versionNumber ?? b.number ?? 0) - (a.versionNumber ?? a.number ?? 0))[0] ??
    versionSummary(course, course.latestPublishedVersionId, 'published');

  return {
    ...course,
    id: course.id ?? '',
    ownerType: course.ownerType === 'partner' ? 'partner' : 'company',
    ownerUserId: course.ownerUserId ?? course.authorId,
    title: course.title ?? latestPublishedVersion?.title ?? draftVersion?.title ?? 'Курс',
    lifecycleStatus:
      course.lifecycleStatus === 'archived' || course.lifecycleStatus === 'deleted'
        ? course.lifecycleStatus
        : 'active',
    distributionStatus:
      course.distributionStatus === 'paused' || course.distributionStatus === 'blocked'
        ? course.distributionStatus
        : 'active',
    latestPublishedVersion: normalizeVersionReference(course, latestPublishedVersion, 'published'),
    draftVersion: normalizeVersionReference(course, draftVersion, 'draft'),
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

type LessonAuthorWire = CourseVersionAuthorDetail['sections'][number]['lessons'][number] & {
  lessonId?: ID;
  lessonVersionId?: ID;
  sectionVersionId?: ID;
  courseVersionId?: ID;
};

type SectionAuthorWire = Omit<CourseVersionAuthorDetail['sections'][number], 'lessons'> & {
  sectionId?: ID;
  sectionVersionId?: ID;
  courseVersionId?: ID;
  lessons?: LessonAuthorWire[] | null;
};

type DraftWire = Omit<CourseVersionAuthorDetail, 'sections'> & {
  courseVersionId?: ID;
  sections?: SectionAuthorWire[] | null;
};

export function normalizeDraft(draft: DraftWire): CourseVersionAuthorDetail {
  const versionId = draft.courseVersionId ?? draft.id;
  return {
    ...draft,
    id: versionId,
    sections: (draft.sections ?? []).map((section) => ({
      ...section,
      id: section.sectionVersionId ?? section.id,
      versionId: section.courseVersionId ?? section.versionId ?? versionId,
      lessons: (Array.isArray(section.lessons) ? section.lessons : []).map((lesson) => ({
        ...lesson,
        id: lesson.lessonVersionId ?? lesson.id,
        sectionId: lesson.sectionVersionId ?? section.sectionVersionId ?? section.id,
        versionId: lesson.courseVersionId ?? lesson.versionId ?? versionId,
        quiz: lesson.quiz
          ? {
              ...lesson.quiz,
              lessonId: lesson.lessonVersionId ?? lesson.id,
            }
          : undefined,
      })),
    })),
  };
}

function normalizeCourseCreation(payload: CourseCreationWire): CourseCreationResult {
  const envelope = 'course' in payload ? payload : { course: payload };
  const draft = envelope.draft ? normalizeDraft(envelope.draft) : undefined;
  const course = normalizeCourse({
    ...envelope.course,
    currentDraftVersionId: envelope.course.currentDraftVersionId ?? draft?.id,
  });
  return { course, draft };
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

  async createDetailed(
    input: CreateCourseInput,
    options?: RequestOptions,
  ): Promise<CourseCreationResult> {
    // Server sets owner type from role — body must not spoof owner.
    return normalizeCourseCreation(
      await academyMutate<CourseCreationWire>('/academy/courses', 'POST', input, options),
    );
  },

  async create(input: CreateCourseInput, options?: RequestOptions): Promise<AcademyCourseDetail> {
    return (await academyCoursesApi.createDetailed(input, options)).course;
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

  getPartnerAudience(courseId: ID, options?: RequestOptions): Promise<CoursePartnerAudience> {
    return academyGet(`/academy/courses/${encodeId(courseId)}/partner-audience`, options);
  },

  setPartnerAudience(
    courseId: ID,
    input: SetCoursePartnerAudienceInput,
    options?: RequestOptions,
  ): Promise<CoursePartnerAudience> {
    return academyMutate(
      `/academy/courses/${encodeId(courseId)}/partner-audience`,
      'PUT',
      {
        audience: input.audience,
        partnerUserIds: input.audience === 'selected_partners' ? (input.partnerUserIds ?? []) : [],
      },
      options,
    );
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

  /**
   * OpenAPI CourseRestrictionInput requires non-empty `reason`.
   * Response is CourseRestriction — callers should invalidate course queries.
   */
  resolveRestriction(
    courseId: ID,
    input: { reason: string },
    options?: RequestOptions,
  ): Promise<unknown> {
    return academyMutate(
      `/academy/courses/${encodeId(courseId)}/restrictions/resolve`,
      'POST',
      { reason: input.reason },
      options,
    );
  },

  /**
   * Backend returns PartnerCourseCopyResult: { course, draft, origin }.
   * Unpack to the company course detail so callers can navigate by id.
   */
  async copyToCompany(
    courseId: ID,
    input: { versionId: ID },
    options?: RequestOptions,
  ): Promise<AcademyCourseDetail> {
    const payload = await academyMutate<CourseCreationWire>(
      `/academy/partner-courses/${encodeId(courseId)}/versions/${encodeId(input.versionId)}/copy-to-company`,
      'POST',
      {},
      options,
    );
    return normalizeCourseCreation(payload).course;
  },

  async getDraft(courseId: ID, options?: RequestOptions): Promise<CourseVersionAuthorDetail> {
    return normalizeDraft(
      await academyGet<DraftWire>(`/academy/courses/${encodeId(courseId)}/draft`, options),
    );
  },

  /** Ensure draft exists (backend may create version 1). */
  async ensureDraft(courseId: ID, options?: RequestOptions): Promise<CourseVersionAuthorDetail> {
    return normalizeDraft(
      await academyMutate<DraftWire>(
        `/academy/courses/${encodeId(courseId)}/draft`,
        'POST',
        {},
        options,
      ),
    );
  },
};
