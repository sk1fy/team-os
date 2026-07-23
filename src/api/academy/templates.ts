import type {
  AcademyCourseDetail,
  AcademyTemplateSummary,
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

type TemplateVersionWire = {
  id: ID;
  number?: number;
  status?: string;
  title?: string;
  description?: string;
};

type TemplateWire = Partial<AcademyTemplateSummary> & {
  id: ID;
  type?: 'system' | 'company';
  systemTemplateKey?: string;
  lifecycleStatus?: string;
  latestPublishedVersionId?: ID;
  currentDraftVersionId?: ID;
  versions?: TemplateVersionWire[];
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
    template.versions?.find((version) => version.status === 'published');
  const ownerType = template.ownerType ?? (template.type === 'company' ? 'company' : 'system');

  return {
    ...template,
    id: template.id,
    ownerType,
    title: template.title ?? latestVersion?.title ?? fallbackTemplateTitle(template),
    description: template.description ?? latestVersion?.description,
    latestVersionId,
    latestVersionNumber: template.latestVersionNumber ?? latestVersion?.number,
    draftVersionId: template.draftVersionId ?? template.currentDraftVersionId,
    archived: template.archived ?? template.lifecycleStatus === 'archived',
    capabilities: template.capabilities ?? {
      canInstantiate: Boolean(latestVersionId),
      canEdit: false,
      canArchive: false,
      canPreview: Boolean(latestVersionId),
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

  getPreview(templateId: ID, options?: RequestOptions): Promise<CourseVersionAuthorDetail> {
    return academyGet(`/academy/templates/${encodeId(templateId)}/preview`, options);
  },

  createDraft(templateId: ID, options?: RequestOptions): Promise<AcademyTemplateSummary> {
    return academyMutate(`/academy/templates/${encodeId(templateId)}/draft`, 'POST', {}, options);
  },

  updateDraft(
    templateId: ID,
    input: { title?: string; description?: string },
    options?: RequestOptions,
  ): Promise<AcademyTemplateSummary> {
    return academyMutate(
      `/academy/templates/${encodeId(templateId)}/draft`,
      'PATCH',
      input,
      options,
    );
  },

  publish(templateId: ID, options?: RequestOptions): Promise<AcademyTemplateSummary> {
    return academyMutate(`/academy/templates/${encodeId(templateId)}/publish`, 'POST', {}, options);
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
    return academyMutate(`/academy/templates/${encodeId(templateId)}/archive`, 'POST', {}, options);
  },
};
