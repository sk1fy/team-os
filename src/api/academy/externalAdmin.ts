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

export const academyExternalAdminApi = {
  listPersonalAccesses(
    courseId: ID,
    filters: { page?: number; pageSize?: number; status?: string } = {},
    options?: RequestOptions,
  ): Promise<PaginatedResult<PersonalAccessSummary>> {
    return academyGet(
      `/academy/v2/courses/${encodeId(courseId)}/personal-accesses${buildQuery(filters)}`,
      options,
    );
  },

  createPersonalAccess(
    courseId: ID,
    input: { email?: string; displayName?: string; deadlineDays: number; courseVersionId?: ID },
    options?: RequestOptions,
  ): Promise<PersonalAccessSummary> {
    return academyMutate(
      `/academy/v2/courses/${encodeId(courseId)}/personal-accesses`,
      'POST',
      input,
      options,
    );
  },

  rotatePersonalAccess(accessId: ID, options?: RequestOptions): Promise<PersonalAccessSummary> {
    return academyMutate(
      `/academy/v2/personal-accesses/${encodeId(accessId)}/rotate`,
      'POST',
      {},
      options,
    );
  },

  revokePersonalAccess(accessId: ID, options?: RequestOptions): Promise<void> {
    return academyMutate(
      `/academy/v2/personal-accesses/${encodeId(accessId)}/revoke`,
      'POST',
      {},
      options,
    );
  },

  extendEnrollment(
    enrollmentId: ID,
    input: { extraDays: number },
    options?: RequestOptions,
  ): Promise<void> {
    return academyMutate(
      `/academy/v2/enrollments/${encodeId(enrollmentId)}/extend`,
      'POST',
      input,
      options,
    );
  },

  repeatEnrollment(enrollmentId: ID, options?: RequestOptions): Promise<{ enrollmentId: ID }> {
    return academyMutate(
      `/academy/v2/enrollments/${encodeId(enrollmentId)}/repeat`,
      'POST',
      {},
      options,
    );
  },

  listCampaigns(
    courseId: ID,
    options?: RequestOptions,
  ): Promise<ExternalCampaignSummary[]> {
    return academyGet(`/academy/v2/courses/${encodeId(courseId)}/campaigns`, options);
  },

  createCampaign(
    courseId: ID,
    input: {
      purpose: 'promo' | 'candidate';
      name: string;
      courseVersionId?: ID;
      deadlineDays: number;
    },
    options?: RequestOptions,
  ): Promise<ExternalCampaignSummary> {
    return academyMutate(
      `/academy/v2/courses/${encodeId(courseId)}/campaigns`,
      'POST',
      input,
      options,
    );
  },

  campaignReport(campaignId: ID, options?: RequestOptions): Promise<CampaignReport> {
    return academyGet(`/academy/v2/campaigns/${encodeId(campaignId)}/report`, options);
  },

  listLearners(
    filters: { q?: string; page?: number; pageSize?: number } = {},
    options?: RequestOptions,
  ): Promise<PaginatedResult<ExternalLearnerSummary>> {
    return academyGet(`/academy/v2/external-learners${buildQuery(filters)}`, options);
  },

  getLearner(learnerId: ID, options?: RequestOptions): Promise<ExternalLearnerDetail> {
    return academyGet(`/academy/v2/external-learners/${encodeId(learnerId)}`, options);
  },
};
