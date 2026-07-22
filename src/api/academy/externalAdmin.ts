import type {
  CampaignReport,
  ExternalCampaignSummary,
  ExternalLearnerDetail,
  ExternalLearnerSummary,
  PersonalAccessSummary,
} from '@/types/academyExternal';
import type { PaginatedResult } from '@/types/academy';
import type { ID } from '@/types';
import { academyGet, academyMutate, buildQuery, encodeId, type RequestOptions } from './httpHelpers';

/** Backend-plan §11.6–11.7, §11.9 */
export const academyExternalAdminApi = {
  listPersonalAccesses(
    courseId: ID,
    filters: { page?: number; pageSize?: number; status?: string } = {},
    options?: RequestOptions,
  ): Promise<PaginatedResult<PersonalAccessSummary>> {
    return academyGet(
      `/academy/courses/${encodeId(courseId)}/personal-accesses${buildQuery(filters)}`,
      options,
    );
  },

  createPersonalAccess(
    courseId: ID,
    versionId: ID,
    input: {
      email?: string;
      firstName?: string;
      lastName?: string;
      deadlineDays: number;
    },
    options?: RequestOptions,
  ): Promise<PersonalAccessSummary> {
    return academyMutate(
      `/academy/courses/${encodeId(courseId)}/versions/${encodeId(versionId)}/personal-accesses`,
      'POST',
      input,
      options,
    );
  },

  rotatePersonalAccess(accessId: ID, options?: RequestOptions): Promise<PersonalAccessSummary> {
    return academyMutate(
      `/academy/personal-accesses/${encodeId(accessId)}/rotate-token`,
      'POST',
      {},
      options,
    );
  },

  revokePersonalAccess(accessId: ID, options?: RequestOptions): Promise<void> {
    return academyMutate(
      `/academy/personal-accesses/${encodeId(accessId)}/revoke`,
      'POST',
      {},
      options,
    );
  },

  extendPersonalAccess(
    accessId: ID,
    input: { extraDays: number },
    options?: RequestOptions,
  ): Promise<void> {
    return academyMutate(
      `/academy/personal-accesses/${encodeId(accessId)}/extend`,
      'POST',
      input,
      options,
    );
  },

  repeatPersonalAccess(accessId: ID, options?: RequestOptions): Promise<{ enrollmentId: ID }> {
    return academyMutate(
      `/academy/personal-accesses/${encodeId(accessId)}/repeat`,
      'POST',
      {},
      options,
    );
  },

  listCampaigns(courseId: ID, options?: RequestOptions): Promise<ExternalCampaignSummary[]> {
    return academyGet(`/academy/courses/${encodeId(courseId)}/campaigns`, options);
  },

  createCampaign(
    courseId: ID,
    versionId: ID,
    input: {
      purpose: 'promo' | 'candidate' | 'partner_promo' | 'company_candidate';
      name: string;
      deadlineDays: number;
    },
    options?: RequestOptions,
  ): Promise<ExternalCampaignSummary> {
    return academyMutate(
      `/academy/courses/${encodeId(courseId)}/versions/${encodeId(versionId)}/campaigns`,
      'POST',
      input,
      options,
    );
  },

  campaignReport(campaignId: ID, options?: RequestOptions): Promise<CampaignReport> {
    return academyGet(`/academy/campaigns/${encodeId(campaignId)}/report`, options);
  },

  listLearners(
    filters: { q?: string; page?: number; pageSize?: number } = {},
    options?: RequestOptions,
  ): Promise<PaginatedResult<ExternalLearnerSummary>> {
    return academyGet(`/academy/external-learners${buildQuery(filters)}`, options);
  },

  getLearner(learnerId: ID, options?: RequestOptions): Promise<ExternalLearnerDetail> {
    return academyGet(`/academy/external-learners/${encodeId(learnerId)}`, options);
  },
};
