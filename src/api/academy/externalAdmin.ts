import type {
  CampaignReport,
  CampaignPurpose,
  ExternalCampaignSummary,
  ExternalLearnerDetail,
  ExternalLearnerSummary,
  PersonalAccessSummary,
} from '@/types/academyExternal';
import type { PaginatedResult } from '@/types/academy';
import type { ID } from '@/types';
import { createId } from '@/lib/id';
import {
  academyGet,
  academyMutate,
  buildQuery,
  encodeId,
  type RequestOptions,
} from './httpHelpers';
import {
  normalizeCampaign,
  normalizeCampaignCreated,
  normalizeCampaignReport,
  normalizeExternalLearnerDetail,
  normalizeExternalLearnerSummary,
  normalizePersonalAccess,
  normalizePersonalAccessCreated,
  paginateArray,
} from './wireAdapters';

/** Backend-plan §11.6–11.7, §11.9 — OpenAPI ExternalPersonalAccess / ExternalCampaign. */
export const academyExternalAdminApi = {
  async listPersonalAccesses(
    courseId: ID,
    filters: { page?: number; pageSize?: number; status?: string } = {},
    options?: RequestOptions,
  ): Promise<PaginatedResult<PersonalAccessSummary>> {
    const payload = await academyGet<unknown>(
      `/academy/courses/${encodeId(courseId)}/personal-accesses${buildQuery(filters)}`,
      options,
    );
    if (Array.isArray(payload)) {
      const items = payload.map((item) => normalizePersonalAccess(item));
      return paginateArray(items, filters);
    }
    const record =
      typeof payload === 'object' && payload !== null
        ? (payload as {
            items?: unknown[];
            page?: number;
            pageSize?: number;
            total?: number;
            totalPages?: number;
          })
        : {};
    const items = Array.isArray(record.items)
      ? record.items.map((item) => normalizePersonalAccess(item))
      : [];
    return {
      items,
      page: record.page || filters.page || 1,
      pageSize: record.pageSize || filters.pageSize || 25,
      total: record.total ?? items.length,
      totalPages:
        record.totalPages || Math.max(1, Math.ceil(items.length / (filters.pageSize || 25))),
    };
  },

  async createPersonalAccess(
    courseId: ID,
    versionId: ID,
    input: {
      email: string;
      firstName?: string;
      lastName?: string;
      deadlineDays: number;
    },
    options?: RequestOptions,
  ): Promise<PersonalAccessSummary> {
    const wire = await academyMutate<unknown>(
      `/academy/courses/${encodeId(courseId)}/versions/${encodeId(versionId)}/personal-accesses`,
      'POST',
      input,
      { ...options, idempotencyKey: options?.idempotencyKey ?? createId() },
    );
    return normalizePersonalAccessCreated(wire);
  },

  async rotatePersonalAccess(
    accessId: ID,
    options?: RequestOptions,
  ): Promise<PersonalAccessSummary> {
    const wire = await academyMutate<unknown>(
      `/academy/personal-accesses/${encodeId(accessId)}/rotate-token`,
      'POST',
      {},
      { ...options, idempotencyKey: options?.idempotencyKey ?? createId() },
    );
    return normalizePersonalAccessCreated(wire);
  },

  revokePersonalAccess(accessId: ID, options?: RequestOptions): Promise<void> {
    return academyMutate(
      `/academy/personal-accesses/${encodeId(accessId)}/revoke`,
      'POST',
      {},
      options,
    );
  },

  /**
   * OpenAPI ExtendExternalPersonalAccessInput requires deadlineDays (1–7),
   * not extraDays.
   */
  extendPersonalAccess(
    accessId: ID,
    input: { deadlineDays: number },
    options?: RequestOptions,
  ): Promise<PersonalAccessSummary> {
    return academyMutate<unknown>(
      `/academy/personal-accesses/${encodeId(accessId)}/extend`,
      'POST',
      { deadlineDays: input.deadlineDays },
      options,
    ).then((wire) => normalizePersonalAccess(wire));
  },

  async repeatPersonalAccess(
    accessId: ID,
    options?: RequestOptions,
  ): Promise<PersonalAccessSummary> {
    const wire = await academyMutate<unknown>(
      `/academy/personal-accesses/${encodeId(accessId)}/repeat`,
      'POST',
      {},
      { ...options, idempotencyKey: options?.idempotencyKey ?? createId() },
    );
    return normalizePersonalAccessCreated(wire);
  },

  async listCampaigns(courseId: ID, options?: RequestOptions): Promise<ExternalCampaignSummary[]> {
    const payload = await academyGet<unknown>(
      `/academy/courses/${encodeId(courseId)}/campaigns`,
      options,
    );
    if (Array.isArray(payload)) {
      return payload.map((item) => normalizeCampaign(item));
    }
    const record =
      typeof payload === 'object' && payload !== null ? (payload as { items?: unknown[] }) : {};
    return Array.isArray(record.items) ? record.items.map((item) => normalizeCampaign(item)) : [];
  },

  async getCampaign(campaignId: ID, options?: RequestOptions): Promise<ExternalCampaignSummary> {
    return normalizeCampaign(
      await academyGet<unknown>(`/academy/campaigns/${encodeId(campaignId)}`, options),
    );
  },

  async createCampaign(
    courseId: ID,
    versionId: ID,
    input: {
      purpose: CampaignPurpose;
      name: string;
      deadlineDays: number;
    },
    options?: RequestOptions,
  ): Promise<ExternalCampaignSummary> {
    const wire = await academyMutate<unknown>(
      `/academy/courses/${encodeId(courseId)}/versions/${encodeId(versionId)}/campaigns`,
      'POST',
      input,
      { ...options, idempotencyKey: options?.idempotencyKey ?? createId() },
    );
    return normalizeCampaignCreated(wire);
  },

  async pauseCampaign(campaignId: ID, options?: RequestOptions): Promise<ExternalCampaignSummary> {
    return normalizeCampaign(
      await academyMutate<unknown>(
        `/academy/campaigns/${encodeId(campaignId)}/pause`,
        'POST',
        {},
        options,
      ),
    );
  },

  async resumeCampaign(campaignId: ID, options?: RequestOptions): Promise<ExternalCampaignSummary> {
    return normalizeCampaign(
      await academyMutate<unknown>(
        `/academy/campaigns/${encodeId(campaignId)}/resume`,
        'POST',
        {},
        options,
      ),
    );
  },

  async rotateCampaign(campaignId: ID, options?: RequestOptions): Promise<ExternalCampaignSummary> {
    const wire = await academyMutate<unknown>(
      `/academy/campaigns/${encodeId(campaignId)}/rotate-token`,
      'POST',
      {},
      { ...options, idempotencyKey: options?.idempotencyKey ?? createId() },
    );
    return normalizeCampaignCreated(wire);
  },

  async revokeCampaign(campaignId: ID, options?: RequestOptions): Promise<ExternalCampaignSummary> {
    return normalizeCampaign(
      await academyMutate<unknown>(
        `/academy/campaigns/${encodeId(campaignId)}/revoke`,
        'POST',
        {},
        options,
      ),
    );
  },

  async campaignReport(
    campaignId: ID,
    filtersOrOptions: { page?: number; pageSize?: number } | RequestOptions = {},
    options?: RequestOptions,
  ): Promise<CampaignReport> {
    const isLegacyOptions =
      'signal' in filtersOrOptions ||
      'idempotencyKey' in filtersOrOptions ||
      'authMode' in filtersOrOptions;
    const filters: { page?: number; pageSize?: number } = isLegacyOptions
      ? {}
      : (filtersOrOptions as { page?: number; pageSize?: number });
    const requestOptions: RequestOptions | undefined = isLegacyOptions
      ? (filtersOrOptions as RequestOptions)
      : options;
    const wire = await academyGet<unknown>(
      `/academy/campaigns/${encodeId(campaignId)}/report${buildQuery(filters)}`,
      requestOptions,
    );
    return normalizeCampaignReport(wire, filters);
  },

  async listLearners(
    filters: { q?: string; page?: number; pageSize?: number } = {},
    options?: RequestOptions,
  ): Promise<PaginatedResult<ExternalLearnerSummary>> {
    const payload = await academyGet<
      PaginatedResult<ExternalLearnerSummary> | ExternalLearnerSummary[] | unknown
    >(`/academy/external-learners${buildQuery(filters)}`, options);
    if (Array.isArray(payload)) {
      const items = payload.map((item) => normalizeExternalLearnerSummary(item));
      return paginateArray(items, filters);
    }
    const record =
      typeof payload === 'object' && payload !== null
        ? (payload as {
            items?: unknown[];
            page?: number;
            pageSize?: number;
            total?: number;
            totalPages?: number;
          })
        : {};
    const items = Array.isArray(record.items)
      ? record.items.map((item) => normalizeExternalLearnerSummary(item))
      : [];
    return {
      items,
      page: record.page || filters.page || 1,
      pageSize: record.pageSize || filters.pageSize || 25,
      total: record.total ?? items.length,
      totalPages: record.totalPages || 1,
    };
  },

  async getLearner(learnerId: ID, options?: RequestOptions): Promise<ExternalLearnerDetail> {
    const [learner, timeline] = await Promise.all([
      academyGet<unknown>(`/academy/external-learners/${encodeId(learnerId)}`, options),
      academyGet<unknown>(
        `/academy/external-learners/${encodeId(learnerId)}/timeline`,
        options,
      ).catch(() => null),
    ]);
    return normalizeExternalLearnerDetail(learner, timeline ?? learner);
  },
};
