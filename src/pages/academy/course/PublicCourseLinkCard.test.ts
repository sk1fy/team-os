import { describe, expect, it } from 'vitest';
import type { ExternalCampaignSummary } from '@/types/academyExternal';
import {
  PUBLIC_COURSE_CAMPAIGN_NAME,
  publicCourseLinkDeadlineDays,
  resolvePublicCourseLinkAction,
} from './publicCourseLink';

const campaign = (overrides: Partial<ExternalCampaignSummary> = {}): ExternalCampaignSummary => ({
  id: 'campaign-1',
  courseId: 'course-1',
  courseVersionId: 'version-1',
  purpose: 'company_candidate',
  name: PUBLIC_COURSE_CAMPAIGN_NAME,
  status: 'active',
  createdAt: '2026-07-28T10:00:00Z',
  ...overrides,
});

describe('public course link campaign', () => {
  it('creates a dedicated campaign when the published version has no public-course campaign', () => {
    expect(
      resolvePublicCourseLinkAction(
        [
          campaign({ id: 'other-name', name: 'Набор кандидатов' }),
          campaign({ id: 'old-version', courseVersionId: 'version-0' }),
          campaign({ id: 'revoked', status: 'revoked' }),
        ],
        'version-1',
      ),
    ).toEqual({ type: 'create' });
  });

  it('rotates only the active dedicated campaign so the secret can be shown again', () => {
    expect(resolvePublicCourseLinkAction([campaign()], 'version-1')).toEqual({
      type: 'rotate',
      campaignId: 'campaign-1',
    });
  });

  it('resumes a paused dedicated campaign before rotating its token', () => {
    expect(
      resolvePublicCourseLinkAction([campaign({ id: 'paused', status: 'paused' })], 'version-1'),
    ).toEqual({
      type: 'resume-and-rotate',
      campaignId: 'paused',
    });
  });

  it('uses an API-valid deadline for the public campaign', () => {
    expect(publicCourseLinkDeadlineDays(1)).toBe(1);
    expect(publicCourseLinkDeadlineDays(7)).toBe(7);
    expect(publicCourseLinkDeadlineDays(undefined)).toBe(3);
    expect(publicCourseLinkDeadlineDays(30)).toBe(3);
  });
});
