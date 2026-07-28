import type { ExternalCampaignSummary } from '@/types/academyExternal';

export const PUBLIC_COURSE_CAMPAIGN_NAME = 'Публичная ссылка курса';

export type PublicLinkAction =
  | { type: 'create' }
  | { type: 'rotate'; campaignId: string }
  | { type: 'resume-and-rotate'; campaignId: string };

export function publicCourseLinkDeadlineDays(deadlineDays: number | undefined): number {
  return Number.isInteger(deadlineDays) && deadlineDays! >= 1 && deadlineDays! <= 7
    ? deadlineDays!
    : 3;
}

export function resolvePublicCourseLinkAction(
  campaigns: ExternalCampaignSummary[],
  versionId: string,
): PublicLinkAction {
  const dedicated = campaigns.filter(
    (campaign) =>
      campaign.courseVersionId === versionId && campaign.name === PUBLIC_COURSE_CAMPAIGN_NAME,
  );
  const active = dedicated.find((campaign) => campaign.status === 'active');
  if (active) return { type: 'rotate', campaignId: active.id };

  const paused = dedicated.find((campaign) => campaign.status === 'paused');
  if (paused) return { type: 'resume-and-rotate', campaignId: paused.id };

  return { type: 'create' };
}
