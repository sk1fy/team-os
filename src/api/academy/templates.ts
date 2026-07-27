import type {
  AcademyCourseDetail,
  AcademyTemplateSummary,
  CourseVersionAuthorDetail,
  PaginatedResult,
  QuizQuestionAuthor,
} from '@/types/academy';
import type { ID } from '@/types';
import type { RichTextContent } from '@/types';
import {
  academyGet,
  academyMutate,
  buildQuery,
  encodeId,
  type RequestOptions,
} from './httpHelpers';
import { normalizeCourse } from './courses';
import { normalizeDraft } from './courses';

type TemplateVersionWire = {
  id: ID;
  templateId?: ID;
  number?: number;
  status?: string;
  title?: string;
  description?: string;
  sequential?: boolean;
  content?: TemplateVersionContentWire;
};

type TemplateWire = Partial<AcademyTemplateSummary> & {
  id: ID;
  type?: 'system' | 'company';
  systemTemplateKey?: string;
  lifecycleStatus?: string;
  latestPublishedVersionId?: ID;
  currentDraftVersionId?: ID;
  versions?: TemplateVersionWire[];
  selectedVersion?: TemplateVersionWire;
};

export type TemplateDraftQuizInput = {
  questions: QuizQuestionAuthor[];
  passingScore: number;
  maxAttempts?: number;
};

export type TemplateDraftLessonInput = {
  stableKey: string;
  title: string;
  order: number;
  content: RichTextContent;
  sourceType?: 'manual' | 'kb_link' | 'kb_snapshot' | 'template_snapshot';
  sourceArticleId?: ID;
  sourceArticleVersion?: number;
  estimatedMinutes?: number;
  quiz?: TemplateDraftQuizInput;
};

export type TemplateDraftSectionInput = {
  stableKey: string;
  title: string;
  order: number;
  lessons: TemplateDraftLessonInput[];
};

export type TemplateDraftContentInput = {
  sections: TemplateDraftSectionInput[];
};

type TemplateVersionContentWire = {
  sections?: Array<{
    id: ID;
    templateVersionId: ID;
    stableKey: string;
    title: string;
    order: number;
  }>;
  lessons?: Array<{
    id: ID;
    templateVersionId: ID;
    sectionVersionId: ID;
    stableKey: string;
    title: string;
    order: number;
    content: RichTextContent;
    sourceType?: TemplateDraftLessonInput['sourceType'];
    sourceArticleId?: ID;
    sourceArticleVersion?: number;
    estimatedMinutes?: number;
  }>;
  quizzes?: Array<{
    id: ID;
    templateVersionId: ID;
    lessonVersionId: ID;
    questions: QuizQuestionAuthor[];
    passingScore: number;
    maxAttempts?: number;
  }>;
};

export type TemplateVersionDetail = {
  id: ID;
  templateId: ID;
  number: number;
  status: 'draft' | 'published' | 'retired';
  title: string;
  description?: string;
  sequential: boolean;
  content: TemplateVersionContentWire;
};

export type TemplateDetail = {
  summary: AcademyTemplateSummary;
  selectedVersion?: TemplateVersionDetail;
};

type TemplateInstantiationWire = {
  course: Parameters<typeof normalizeCourse>[0];
  draft: CourseVersionAuthorDetail;
  origin: unknown;
};

export type TemplateInstantiationResult = {
  course: AcademyCourseDetail;
  draft: CourseVersionAuthorDetail;
};

const SYSTEM_TEMPLATE_TITLES: Record<string, string> = {
  'external-partner-course': 'Курс для внешнего партнёра',
  'crm-basics': 'Основы работы в CRM',
  'regulations-knowledge-check': 'Проверка знаний регламентов',
  'intern-preparation': 'Подготовка стажёра',
  'customer-service-standards': 'Стандарты клиентского сервиса',
  'employee-onboarding': 'Онбординг нового сотрудника',
  'manager-onboarding': 'Онбординг руководителя',
  'information-security': 'Информационная безопасность',
  'sales-manager-onboarding': 'Онбординг менеджера по продажам',
  'company-and-product-intro': 'Знакомство с компанией и продуктом',
};

function fallbackTemplateTitle(template: TemplateWire): string {
  if (!template.systemTemplateKey) return 'Шаблон курса';
  return (
    SYSTEM_TEMPLATE_TITLES[template.systemTemplateKey] ??
    template.systemTemplateKey
      .split('-')
      .filter(Boolean)
      .map((word) => word[0]?.toUpperCase() + word.slice(1))
      .join(' ')
  );
}

export function normalizeTemplate(template: TemplateWire): AcademyTemplateSummary {
  const latestVersionId = template.latestVersionId ?? template.latestPublishedVersionId;
  const latestVersion =
    template.versions?.find((version) => version.id === latestVersionId) ??
    template.versions?.find((version) => version.status === 'published') ??
    template.selectedVersion;
  const ownerType = template.ownerType ?? (template.type === 'company' ? 'company' : 'system');
  const draftVersionId =
    template.draftVersionId ??
    template.currentDraftVersionId ??
    template.versions?.find((version) => version.status === 'draft')?.id ??
    (template.selectedVersion?.status === 'draft' ? template.selectedVersion.id : undefined);

  return {
    ...template,
    id: template.id,
    ownerType,
    title: template.title ?? latestVersion?.title ?? fallbackTemplateTitle(template),
    description: template.description ?? latestVersion?.description,
    latestVersionId,
    latestVersionNumber: template.latestVersionNumber ?? latestVersion?.number,
    draftVersionId,
    archived: template.archived ?? template.lifecycleStatus === 'archived',
    capabilities: template.capabilities ?? {
      canInstantiate: Boolean(latestVersionId),
      canEdit: ownerType === 'company',
      canArchive: ownerType === 'company',
      canPreview: Boolean(latestVersionId),
    },
  };
}

function normalizeTemplateVersion(version: TemplateVersionWire): TemplateVersionDetail {
  return {
    id: version.id,
    templateId: version.templateId ?? '',
    number: version.number ?? 1,
    status:
      version.status === 'published' || version.status === 'retired' ? version.status : 'draft',
    title: version.title ?? 'Шаблон курса',
    description: version.description,
    sequential: version.sequential !== false,
    content: {
      sections: version.content?.sections ?? [],
      lessons: version.content?.lessons ?? [],
      quizzes: version.content?.quizzes ?? [],
    },
  };
}

/** Backend-plan §11.5 */
export const academyTemplatesApi = {
  async list(
    filters: { q?: string; ownerType?: string; page?: number; pageSize?: number } = {},
    options?: RequestOptions,
  ): Promise<PaginatedResult<AcademyTemplateSummary>> {
    const payload = await academyGet<PaginatedResult<TemplateWire> | TemplateWire[]>(
      `/academy/templates${buildQuery({
        q: filters.q,
        ownerType: filters.ownerType,
        page: filters.page,
        pageSize: filters.pageSize,
      })}`,
      options,
    );
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 50;
    if (Array.isArray(payload)) {
      return {
        items: payload.map(normalizeTemplate),
        page,
        pageSize,
        total: payload.length,
        totalPages: Math.max(1, Math.ceil(payload.length / pageSize)),
      };
    }
    return {
      ...payload,
      items: (payload.items ?? []).map(normalizeTemplate),
      page: payload.page || page,
      pageSize: payload.pageSize || pageSize,
      total: payload.total ?? payload.items?.length ?? 0,
      totalPages: payload.totalPages || 1,
    };
  },

  async get(templateId: ID, options?: RequestOptions): Promise<AcademyTemplateSummary> {
    return normalizeTemplate(
      await academyGet<TemplateWire>(`/academy/templates/${encodeId(templateId)}`, options),
    );
  },

  async getDetail(
    templateId: ID,
    versionId?: ID,
    options?: RequestOptions,
  ): Promise<TemplateDetail> {
    const payload = await academyGet<TemplateWire>(
      `/academy/templates/${encodeId(templateId)}${buildQuery({ versionId })}`,
      options,
    );
    return {
      summary: normalizeTemplate(payload),
      selectedVersion: payload.selectedVersion
        ? normalizeTemplateVersion(payload.selectedVersion)
        : undefined,
    };
  },

  getPreview(templateId: ID, options?: RequestOptions): Promise<CourseVersionAuthorDetail> {
    return academyGet(`/academy/templates/${encodeId(templateId)}/preview`, options);
  },

  create(
    input: {
      title: string;
      description?: string;
      sequential?: boolean;
      content?: TemplateDraftContentInput;
    },
    options?: RequestOptions,
  ): Promise<TemplateDetail> {
    return academyMutate<TemplateWire>('/academy/templates', 'POST', input, options).then(
      (payload) => ({
        summary: normalizeTemplate(payload),
        selectedVersion: payload.selectedVersion
          ? normalizeTemplateVersion(payload.selectedVersion)
          : undefined,
      }),
    );
  },

  createDraft(templateId: ID, options?: RequestOptions): Promise<TemplateVersionDetail> {
    return academyMutate<TemplateVersionWire>(
      `/academy/templates/${encodeId(templateId)}/draft`,
      'POST',
      {},
      options,
    ).then(normalizeTemplateVersion);
  },

  updateDraft(
    templateId: ID,
    input: {
      title?: string;
      description?: string;
      sequential?: boolean;
      content?: TemplateDraftContentInput;
    },
    options?: RequestOptions,
  ): Promise<TemplateVersionDetail> {
    return academyMutate<TemplateVersionWire>(
      `/academy/templates/${encodeId(templateId)}/draft`,
      'PATCH',
      input,
      options,
    ).then(normalizeTemplateVersion);
  },

  publish(templateId: ID, options?: RequestOptions): Promise<AcademyTemplateSummary> {
    return academyMutate(`/academy/templates/${encodeId(templateId)}/publish`, 'POST', {}, options);
  },

  /** Instantiate a published template version into an independent course draft. */
  instantiateDetailed(
    templateVersionId: ID,
    input: { title?: string } = {},
    options?: RequestOptions,
  ): Promise<TemplateInstantiationResult> {
    return academyMutate<TemplateInstantiationWire>(
      `/academy/template-versions/${encodeId(templateVersionId)}/instantiate`,
      'POST',
      input,
      options,
    ).then((result) => {
      const draft = normalizeDraft(result.draft);
      return {
        course: normalizeCourse({
          ...result.course,
          currentDraftVersionId: result.course.currentDraftVersionId ?? draft.id,
        }),
        draft,
      };
    });
  },

  async instantiate(
    templateVersionId: ID,
    input: { title?: string } = {},
    options?: RequestOptions,
  ): Promise<AcademyCourseDetail> {
    return (await academyTemplatesApi.instantiateDetailed(templateVersionId, input, options))
      .course;
  },

  archive(templateId: ID, options?: RequestOptions): Promise<AcademyTemplateSummary> {
    return academyMutate(`/academy/templates/${encodeId(templateId)}/archive`, 'POST', {}, options);
  },
};
