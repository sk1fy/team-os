/**
 * External Academy types — public learner flow without TeamOS User.
 * Tokens are secrets: never persist in localStorage or analytics.
 */

import type { ID, ISODate } from './index';
import type {
  CourseVersionLearnerDetail,
  EnrollmentDetail,
  EnrollmentSummary,
  QuizAttemptResult,
} from './academy';

export type CampaignPurpose = 'company_candidate' | 'partner_promo';
export type ExternalAccessPurpose = 'personal' | CampaignPurpose;

export type ExternalLandingStatus =
  | 'valid'
  | 'expired'
  | 'revoked'
  | 'course_archived'
  | 'course_deleted'
  | 'course_blocked'
  | 'distribution_paused'
  | 'already_activated';

export interface ExternalAccessLanding {
  tokenHint?: string;
  status: ExternalLandingStatus;
  purpose: ExternalAccessPurpose;
  courseTitle: string;
  courseDescription?: string;
  courseCoverUrl?: string;
  partnerName?: string;
  companyName?: string;
  /** Author-configured deadline (1–7). Learner must not choose this. */
  deadlineDays: number;
  /** @deprecated Prefer deadlineDays; kept if backend still sends options for display. */
  deadlineDaysOptions?: number[];
  defaultDeadlineDays?: number;
  requiresEmailVerification: boolean;
  /** Personal links may prefill and lock the recipient email. */
  expectedEmail?: string;
  maskedEmail?: string;
  emailLocked?: boolean;
  existingEnrollmentId?: ID;
  message?: string;
}

export interface ExternalVerificationChallenge {
  challengeId: ID;
  email: string;
  expiresAt: ISODate;
  resendAvailableAt?: ISODate;
}

export interface ExternalSessionState {
  enrollmentId?: ID;
  accessStatus: EnrollmentSummary['accessStatus'];
  expiresAt?: ISODate;
}

/** Public enrollment state. Outline is fetched separately by contract. */
export type ExternalEnrollmentDetail = Omit<EnrollmentDetail, 'outline'>;

export interface ExternalQuizSubmitResponse {
  attempt: QuizAttemptResult;
  enrollment: ExternalEnrollmentDetail;
}

export interface ExternalLearnerSummary {
  id: ID;
  email: string;
  displayName?: string;
  companyId: ID;
  firstSeenAt: ISODate;
  lastActivityAt?: ISODate;
  enrollmentCount: number;
  completedCount: number;
}

export interface ExternalLearnerTimelineNode {
  enrollmentId: ID;
  courseId?: ID;
  courseTitle: string;
  purpose: ExternalAccessPurpose;
  partnerName?: string;
  progressStatus: EnrollmentSummary['progressStatus'];
  accessStatus: EnrollmentSummary['accessStatus'];
  percent: number;
  activatedAt?: ISODate;
  completedAt?: ISODate;
  accessUntil?: ISODate;
  courseDeleted?: boolean;
  campaignId?: ID;
  campaignName?: string;
}

export interface ExternalLearnerDetail extends ExternalLearnerSummary {
  timeline: ExternalLearnerTimelineNode[];
}

export interface PersonalAccessSummary {
  id: ID;
  courseId: ID;
  courseVersionId: ID;
  email: string;
  displayName?: string;
  status: 'issued' | 'activated' | 'revoked' | 'closed';
  deadlineDays: number;
  issuedAt: ISODate;
  activatedAt?: ISODate;
  revokedAt?: ISODate;
  enrollmentId?: ID;
  lastRotatedAt?: ISODate;
  /** One-time raw token — only present on create/rotate response. */
  oneTimeToken?: string;
  publicUrl?: string;
}

export interface ExternalCampaignSummary {
  id: ID;
  courseId: ID;
  courseVersionId: ID;
  purpose: CampaignPurpose;
  name: string;
  status: 'active' | 'paused' | 'revoked' | 'closed';
  createdAt: ISODate;
  publicUrl?: string;
  /** One-time raw token on create. */
  oneTimeToken?: string;
  stats?: {
    landings: number;
    verified: number;
    activated: number;
    completed: number;
    expired: number;
  };
}

export interface CampaignReport {
  campaignId: ID;
  campaignName: string;
  purpose: CampaignPurpose;
  courseTitle: string;
  funnel: {
    landings: number;
    verified: number;
    activated: number;
    inProgress: number;
    completed: number;
    expired: number;
  };
  participants: PaginatedExternalParticipants;
  utmBreakdown?: Array<{ source?: string; medium?: string; campaign?: string; count: number }>;
}

export interface ExternalParticipantRow {
  enrollmentId: ID;
  learnerId: ID;
  email: string;
  displayName?: string;
  progressStatus: EnrollmentSummary['progressStatus'];
  accessStatus: EnrollmentSummary['accessStatus'];
  percent: number;
  activatedAt?: ISODate;
  completedAt?: ISODate;
  accessUntil?: ISODate;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export interface PaginatedExternalParticipants {
  items: ExternalParticipantRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface EnrollmentReport {
  enrollment: EnrollmentSummary;
  lessonResults: Array<{
    lessonId: ID;
    title: string;
    completed: boolean;
    completedAt?: ISODate;
    quizScore?: number;
    quizPassed?: boolean;
  }>;
  quizAttempts: QuizAttemptResult[];
  learnerEmail?: string;
  learnerName?: string;
}

export type ExternalEnrollmentResults = EnrollmentReport;

/** Re-export for external player adapters. */
export type {
  CourseVersionLearnerDetail,
  EnrollmentDetail,
  EnrollmentSummary,
  QuizAttemptResult,
};
