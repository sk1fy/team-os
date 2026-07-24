/**
 * Adapters from backend OpenAPI wire shapes (contracts/openapi/teamos.yaml)
 * to UI-facing Academy types. Keeps pages free of field-name drift.
 */

import type {
  CourseVersionLearnerDetail,
  EnrollmentAccessStatus,
  EnrollmentDetail,
  EnrollmentProgressStatus,
  EnrollmentSummary,
  LessonLearner,
  QuizAttemptAnswer,
  QuizAttemptResult,
} from '@/types/academy';
import type {
  CampaignReport,
  ExternalAccessLanding,
  ExternalAccessPurpose,
  ExternalCampaignSummary,
  ExternalParticipantRow,
  ExternalEnrollmentResults,
  ExternalLandingStatus,
  ExternalLearnerDetail,
  ExternalLearnerSummary,
  ExternalLearnerTimelineNode,
  ExternalSessionState,
  ExternalVerificationChallenge,
  PersonalAccessSummary,
} from '@/types/academyExternal';
import type { ID } from '@/types';
import { academyRoutes } from '@/lib/academy/routes';

/** Backend enrollment fragment shared by internal/external read models. */
export type EnrollmentWire = Partial<EnrollmentSummary> & {
  id: ID;
  courseId: ID;
  courseVersionId: ID;
  progressPercent?: number;
  currentLessonVersionId?: ID;
  versionNumber?: number;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** UI → REST quiz answers (OpenAPI ExternalQuizAnswer). */
export function toWireQuizAnswers(answers: QuizAttemptAnswer[]): Array<{
  questionId: ID;
  optionIds?: ID[];
  text?: string;
}> {
  return answers.map((answer) => {
    const optionIds =
      answer.selectedOptionIds ??
      (Array.isArray((answer as { optionIds?: ID[] }).optionIds)
        ? (answer as { optionIds?: ID[] }).optionIds
        : undefined);
    const text =
      answer.openText ??
      (typeof (answer as { text?: string }).text === 'string'
        ? (answer as { text?: string }).text
        : undefined);
    return {
      questionId: answer.questionId,
      ...(optionIds && optionIds.length > 0 ? { optionIds } : {}),
      ...(text && text.trim() ? { text } : {}),
    };
  });
}

/** REST/gRPC quiz attempt → UI QuizAttemptResult. */
export function normalizeQuizAttempt(
  wire: unknown,
  options: { enrollmentId?: ID; quizId?: ID } = {},
): QuizAttemptResult {
  const record = isRecord(wire) ? wire : {};
  const nested = isRecord(record.attempt) ? record.attempt : record;
  const answers = Array.isArray(nested.answers)
    ? nested.answers.flatMap((answer) => {
        if (!isRecord(answer) || typeof answer.questionId !== 'string') return [];
        const selectedOptionIds = Array.isArray(answer.selectedOptionIds)
          ? answer.selectedOptionIds.map(String)
          : Array.isArray(answer.optionIds)
            ? answer.optionIds.map(String)
            : undefined;
        const openText = asOptionalString(answer.openText ?? answer.text);
        return [
          {
            questionId: answer.questionId,
            ...(selectedOptionIds?.length ? { selectedOptionIds } : {}),
            ...(openText ? { openText } : {}),
          },
        ];
      })
    : undefined;
  return {
    attemptId: asString(nested.attemptId ?? nested.id),
    quizId: asString(nested.quizId ?? nested.quizVersionId ?? options.quizId),
    enrollmentId: asString(nested.enrollmentId ?? options.enrollmentId),
    answers,
    score: asNumber(nested.score),
    passed: nested.passed === true,
    pendingReview: nested.pendingReview === true,
    attemptsUsed: asNumber(nested.attemptsUsed ?? nested.attemptNumber),
    maxAttempts:
      asOptionalNumber(nested.maxAttempts) ??
      (typeof nested.attemptsRemaining === 'number'
        ? asNumber(nested.attemptsUsed ?? nested.attemptNumber) + asNumber(nested.attemptsRemaining)
        : undefined),
    feedback: Array.isArray(nested.feedback) ? nested.feedback : [],
    reviewComment: asOptionalString(nested.reviewComment),
    createdAt: asString(nested.createdAt),
  };
}

export function buildPublicAccessUrl(token: string): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${academyRoutes.externalLanding(token)}`;
  }
  return academyRoutes.externalLanding(token);
}

// ---------------------------------------------------------------------------
// External landing / session
// ---------------------------------------------------------------------------

function mapAccessPurpose(kind: unknown): ExternalAccessPurpose {
  if (kind === 'partner_promo_campaign' || kind === 'partner_promo') return 'partner_promo';
  if (kind === 'company_candidate_campaign' || kind === 'company_candidate') {
    return 'company_candidate';
  }
  return 'personal';
}

function mapUnavailableReason(reason: unknown): ExternalLandingStatus {
  const value = asString(reason).toLowerCase();
  if (!value) return 'revoked';
  if (value.includes('already') || value.includes('activated')) return 'already_activated';
  if (value.includes('expired') || value.includes('deadline')) return 'expired';
  if (value.includes('revok')) return 'revoked';
  if (value.includes('archiv')) return 'course_archived';
  if (value.includes('delet')) return 'course_deleted';
  if (value.includes('block')) return 'course_blocked';
  if (value.includes('pause') || value.includes('distribution')) return 'distribution_paused';
  if (
    value === 'expired' ||
    value === 'revoked' ||
    value === 'course_archived' ||
    value === 'course_deleted' ||
    value === 'course_blocked' ||
    value === 'distribution_paused' ||
    value === 'already_activated' ||
    value === 'valid'
  ) {
    return value as ExternalLandingStatus;
  }
  return 'revoked';
}

export function normalizeExternalLanding(wire: unknown): ExternalAccessLanding {
  const record = isRecord(wire) ? wire : {};
  const available = record.available !== false && record.status !== 'invalid';
  const status: ExternalLandingStatus =
    typeof record.status === 'string' && record.status !== 'valid'
      ? mapUnavailableReason(record.status)
      : available
        ? 'valid'
        : mapUnavailableReason(record.unavailableReason ?? record.message);

  return {
    tokenHint: asOptionalString(record.tokenHint),
    status,
    purpose: mapAccessPurpose(record.kind ?? record.purpose),
    courseTitle: asString(record.courseTitle ?? record.title, 'Курс'),
    courseDescription: asOptionalString(record.courseDescription ?? record.description),
    courseCoverUrl: asOptionalString(record.courseCoverUrl ?? record.coverUrl),
    partnerName: asOptionalString(record.partnerName),
    companyName: asOptionalString(record.companyName),
    deadlineDays: asNumber(record.deadlineDays, 3),
    deadlineDaysOptions: Array.isArray(record.deadlineDaysOptions)
      ? (record.deadlineDaysOptions as number[])
      : undefined,
    defaultDeadlineDays: asOptionalNumber(record.defaultDeadlineDays),
    requiresEmailVerification:
      record.requiresEmailVerification === true ||
      record.emailVerificationRequired === true ||
      // Backend requires verification for public external access by default.
      (record.emailVerificationRequired !== false && record.requiresEmailVerification !== false),
    expectedEmail: asOptionalString(record.expectedEmail),
    maskedEmail: asOptionalString(record.maskedEmail),
    emailLocked: record.emailLocked === true || Boolean(record.expectedEmail),
    existingEnrollmentId: asOptionalString(record.existingEnrollmentId ?? record.enrollmentId),
    message: asOptionalString(record.message ?? record.unavailableReason),
  };
}

export function normalizeVerificationChallenge(wire: unknown): ExternalVerificationChallenge {
  const record = isRecord(wire) ? wire : {};
  return {
    challengeId: asString(record.challengeId ?? record.id),
    email: asString(record.email),
    expiresAt: asString(record.expiresAt),
    resendAvailableAt: asOptionalString(record.resendAvailableAt),
  };
}

/**
 * Backend returns { learnerId, verifiedAt } and sets external session cookie.
 * UI treats this as "ready to activate".
 */
export function normalizeVerificationConfirmed(wire: unknown): ExternalSessionState & {
  readyEnrollmentId?: ID;
  learnerId?: ID;
  verifiedAt?: string;
} {
  const record = isRecord(wire) ? wire : {};
  if (typeof record.accessStatus === 'string') {
    return {
      enrollmentId: asOptionalString(record.enrollmentId ?? record.readyEnrollmentId),
      readyEnrollmentId: asOptionalString(record.readyEnrollmentId ?? record.enrollmentId),
      accessStatus: record.accessStatus as EnrollmentAccessStatus,
      expiresAt: asOptionalString(record.expiresAt),
      learnerId: asOptionalString(record.learnerId),
      verifiedAt: asOptionalString(record.verifiedAt),
    };
  }
  return {
    learnerId: asOptionalString(record.learnerId),
    verifiedAt: asOptionalString(record.verifiedAt),
    accessStatus: 'ready',
    enrollmentId: asOptionalString(record.enrollmentId),
    readyEnrollmentId: asOptionalString(record.readyEnrollmentId ?? record.enrollmentId),
  };
}

// ---------------------------------------------------------------------------
// Enrollment / outline / lesson / results
// ---------------------------------------------------------------------------

function progressStatusFromWire(value: unknown): EnrollmentProgressStatus {
  return value === 'in_progress' || value === 'completed' ? value : 'not_started';
}

function accessStatusFromWire(value: unknown): EnrollmentAccessStatus {
  return value === 'invited' ||
    value === 'ready' ||
    value === 'expired' ||
    value === 'frozen' ||
    value === 'suspended' ||
    value === 'revoked' ||
    value === 'closed'
    ? value
    : 'active';
}

export function normalizeEnrollmentSummary(
  wire: EnrollmentWire,
  options: { courseTitle?: string; completedLessons?: number; totalLessons?: number } = {},
): EnrollmentSummary {
  return {
    ...wire,
    id: wire.id,
    courseId: wire.courseId,
    courseVersionId: wire.courseVersionId,
    courseTitle: wire.courseTitle ?? options.courseTitle ?? 'Курс',
    learnerType: wire.learnerType === 'external' ? 'external' : 'user',
    progressStatus: progressStatusFromWire(wire.progressStatus),
    accessStatus: accessStatusFromWire(wire.accessStatus),
    percent: wire.percent ?? wire.progressPercent ?? 0,
    completedLessons: wire.completedLessons ?? options.completedLessons ?? 0,
    totalLessons: wire.totalLessons ?? options.totalLessons ?? 0,
    currentLessonId: wire.currentLessonId ?? wire.currentLessonVersionId,
  };
}

export function normalizeExternalEnrollment(
  wire: unknown,
  options: { courseTitle?: string; completedLessons?: number; totalLessons?: number } = {},
): EnrollmentDetail {
  const record = isRecord(wire) ? wire : {};
  const nested = isEnrollmentLike(record.enrollment) ? record.enrollment : record;
  const summary = normalizeEnrollmentSummary(nested as EnrollmentWire, {
    courseTitle: options.courseTitle,
    completedLessons: options.completedLessons,
    totalLessons: options.totalLessons,
  });
  const accessStatus = summary.accessStatus;
  return {
    ...summary,
    outline: {
      id: summary.courseVersionId,
      courseId: summary.courseId,
      versionNumber: asNumber(nested.versionNumber, 1),
      title: summary.courseTitle,
      sequential: true,
      sections: [],
    },
    canCompleteLessons: accessStatus === 'active',
    canSubmitQuiz: accessStatus === 'active',
    isPreview: false,
  };
}

export function isEnrollmentLike(value: unknown): value is EnrollmentWire {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.courseId === 'string' &&
    typeof value.courseVersionId === 'string'
  );
}

type OutlineLessonWire = {
  id?: ID;
  lessonVersionId?: ID;
  title?: string;
  order?: number;
  status?: string;
  locked?: boolean;
  completed?: boolean;
  lockReason?: string;
  hasQuiz?: boolean;
  estimatedMinutes?: number;
};

type OutlineSectionWire = {
  id?: ID;
  title?: string;
  order?: number;
  lessons?: OutlineLessonWire[];
};

export function normalizeExternalOutline(wire: unknown): CourseVersionLearnerDetail {
  const record = isRecord(wire) ? wire : {};
  const enrollment = isEnrollmentLike(record.enrollment) ? record.enrollment : null;
  const sections = Array.isArray(record.sections)
    ? (record.sections as OutlineSectionWire[])
    : Array.isArray(record.outline)
      ? (record.outline as OutlineSectionWire[])
      : [];

  const normalizedSections = sections.map((section, sectionIndex) => ({
    id: asString(section.id, `section-${sectionIndex + 1}`),
    title: asString(section.title, `Раздел ${sectionIndex + 1}`),
    order: asNumber(section.order, sectionIndex),
    lessons: (section.lessons ?? []).map((lesson, lessonIndex) => {
      const status = asString(lesson.status);
      const completed = lesson.completed === true || status === 'completed';
      const locked = lesson.locked === true || status === 'locked';
      return {
        id: asString(lesson.lessonVersionId ?? lesson.id, `lesson-${lessonIndex + 1}`),
        sectionId: asString(section.id),
        title: asString(lesson.title, `Урок ${lessonIndex + 1}`),
        order: asNumber(lesson.order, lessonIndex),
        locked,
        completed,
        hasQuiz: lesson.hasQuiz === true,
        lockReason: asOptionalString(lesson.lockReason),
        estimatedMinutes: asOptionalNumber(lesson.estimatedMinutes),
      };
    }),
  }));

  return {
    id: asString(enrollment?.courseVersionId),
    courseId: asString(enrollment?.courseId),
    versionNumber: asNumber(
      enrollment && 'versionNumber' in enrollment ? enrollment.versionNumber : 1,
      1,
    ),
    title: asString(
      enrollment && 'courseTitle' in enrollment
        ? (enrollment as { courseTitle?: string }).courseTitle
        : undefined,
      'Курс',
    ),
    sequential: true,
    sections: normalizedSections,
  };
}

export function normalizeExternalLesson(wire: unknown): LessonLearner {
  const envelope = isRecord(wire) ? wire : {};
  const lesson = isRecord(envelope.lesson) ? envelope.lesson : envelope;
  const enrollment = isRecord(envelope.enrollment) ? envelope.enrollment : {};
  const status = asString(lesson.status);

  return {
    id: asString(lesson.lessonVersionId ?? lesson.id),
    courseId: asString(lesson.courseId ?? enrollment.courseId),
    sectionId: asString(lesson.sectionId ?? lesson.sectionVersionId),
    versionId: asString(lesson.versionId ?? lesson.courseVersionId ?? enrollment.courseVersionId),
    title: asString(lesson.title, 'Урок'),
    order: asNumber(lesson.order),
    content: isRecord(lesson.content)
      ? (lesson.content as LessonLearner['content'])
      : { type: 'doc', content: [] },
    quiz: isRecord(lesson.quiz) ? (lesson.quiz as unknown as LessonLearner['quiz']) : undefined,
    estimatedMinutes: asOptionalNumber(lesson.estimatedMinutes),
    locked: lesson.locked === true || status === 'locked',
    completed: lesson.completed === true || status === 'completed',
  };
}

export function normalizeExternalResults(
  wire: unknown,
  outline?: CourseVersionLearnerDetail | null,
): ExternalEnrollmentResults {
  const record = isRecord(wire) ? wire : {};
  const completedIds = new Set(
    Array.isArray(record.completedLessonIds) ? (record.completedLessonIds as ID[]).map(String) : [],
  );
  const outlineLessons =
    outline?.sections.flatMap((section) =>
      section.lessons.map((lesson) => ({
        lessonId: lesson.id,
        title: lesson.title,
        completed: completedIds.has(lesson.id) || lesson.completed,
      })),
    ) ?? [];

  let lessonResults =
    Array.isArray(record.lessonResults) && record.lessonResults.length > 0
      ? (record.lessonResults as ExternalEnrollmentResults['lessonResults'])
      : outlineLessons.map((lesson) => ({
          lessonId: lesson.lessonId,
          title: lesson.title,
          completed: lesson.completed,
        }));

  if (lessonResults.length === 0 && completedIds.size > 0) {
    lessonResults = [...completedIds].map((lessonId, index) => ({
      lessonId,
      title: `Урок ${index + 1}`,
      completed: true,
    }));
  }

  const quizAttempts = Array.isArray(record.quizAttempts)
    ? record.quizAttempts.map((attempt) =>
        normalizeQuizAttempt(attempt, {
          enrollmentId: asOptionalString(
            isRecord(record.enrollment) ? record.enrollment.id : undefined,
          ),
        }),
      )
    : [];

  const completedLessons =
    lessonResults.filter((lesson) => lesson.completed).length || completedIds.size;
  const totalLessons = lessonResults.length || completedIds.size;
  const enrollment = normalizeExternalEnrollment(record.enrollment ?? record, {
    completedLessons,
    totalLessons,
    courseTitle: outline?.title,
  });

  return {
    enrollment,
    lessonResults,
    quizAttempts,
  };
}

// ---------------------------------------------------------------------------
// Distribution admin (personal access / campaigns / learners)
// ---------------------------------------------------------------------------

export function normalizePersonalAccess(
  wire: unknown,
  options: { oneTimeToken?: string } = {},
): PersonalAccessSummary {
  const record = isRecord(wire) ? wire : {};
  const token =
    asOptionalString(options.oneTimeToken) ??
    asOptionalString(record.oneTimeToken) ??
    asOptionalString(record.token);
  const email = asString(record.email ?? record.expectedEmail);
  const firstName = asOptionalString(record.displayName ?? record.recipientFirstName);
  const lastName = asOptionalString(record.recipientLastName);
  const displayName =
    firstName && lastName ? `${firstName} ${lastName}`.trim() : (firstName ?? lastName);

  return {
    id: asString(record.id),
    courseId: asString(record.courseId),
    courseVersionId: asString(record.courseVersionId),
    email,
    displayName,
    status:
      record.status === 'activated' || record.status === 'revoked' || record.status === 'closed'
        ? record.status
        : 'issued',
    deadlineDays: asNumber(record.deadlineDays, 3),
    issuedAt: asString(record.issuedAt),
    activatedAt: asOptionalString(record.activatedAt),
    revokedAt: asOptionalString(record.revokedAt),
    enrollmentId: asOptionalString(record.enrollmentId),
    lastRotatedAt: asOptionalString(record.lastRotatedAt),
    oneTimeToken: token,
    publicUrl: token ? buildPublicAccessUrl(token) : asOptionalString(record.publicUrl),
  };
}

export function normalizePersonalAccessCreated(wire: unknown): PersonalAccessSummary {
  const record = isRecord(wire) ? wire : {};
  if (isRecord(record.access)) {
    return normalizePersonalAccess(record.access, {
      oneTimeToken: asOptionalString(record.token),
    });
  }
  return normalizePersonalAccess(record);
}

export function normalizeCampaign(
  wire: unknown,
  options: { oneTimeToken?: string } = {},
): ExternalCampaignSummary {
  const record = isRecord(wire) ? wire : {};
  const token =
    asOptionalString(options.oneTimeToken) ??
    asOptionalString(record.oneTimeToken) ??
    asOptionalString(record.token);
  return {
    id: asString(record.id),
    courseId: asString(record.courseId),
    courseVersionId: asString(record.courseVersionId),
    purpose:
      record.purpose === 'partner_promo' || record.purpose === 'partner_promo_campaign'
        ? 'partner_promo'
        : 'company_candidate',
    name: asString(record.name, 'Кампания'),
    status:
      record.status === 'paused' || record.status === 'revoked' || record.status === 'closed'
        ? record.status
        : 'active',
    createdAt: asString(record.createdAt),
    oneTimeToken: token,
    publicUrl: token ? buildPublicAccessUrl(token) : asOptionalString(record.publicUrl),
    stats: isRecord(record.stats)
      ? {
          landings: asNumber(record.stats.landings),
          verified: asNumber(record.stats.verified),
          activated: asNumber(record.stats.activated),
          completed: asNumber(record.stats.completed),
          expired: asNumber(record.stats.expired),
        }
      : undefined,
  };
}

export function normalizeCampaignCreated(wire: unknown): ExternalCampaignSummary {
  const record = isRecord(wire) ? wire : {};
  if (isRecord(record.campaign)) {
    return normalizeCampaign(record.campaign, {
      oneTimeToken: asOptionalString(record.token),
    });
  }
  return normalizeCampaign(record);
}

export function normalizeCampaignReport(
  wire: unknown,
  filters: { page?: number; pageSize?: number } = {},
): CampaignReport {
  const record = isRecord(wire) ? wire : {};
  const campaignWire = isRecord(record.campaign) ? record.campaign : record;
  const campaign = normalizeCampaign(campaignWire);
  const rawParticipants = Array.isArray(record.enrollments)
    ? record.enrollments
    : isRecord(record.participants) && Array.isArray(record.participants.items)
      ? record.participants.items
      : [];
  const participants = rawParticipants.map((item, index): ExternalParticipantRow => {
    const row = isRecord(item) ? item : {};
    const learnerId = asString(
      row.learnerId ?? row.externalLearnerId,
      `external-learner-${index + 1}`,
    );
    return {
      enrollmentId: asString(row.enrollmentId ?? row.id, `enrollment-${index + 1}`),
      learnerId,
      email: asOptionalString(row.email),
      displayName: asOptionalString(row.displayName ?? row.learnerName),
      progressStatus: progressStatusFromWire(row.progressStatus),
      accessStatus: accessStatusFromWire(row.accessStatus),
      percent: asNumber(row.percent ?? row.progressPercent),
      activatedAt: asOptionalString(row.activatedAt),
      completedAt: asOptionalString(row.completedAt),
      accessUntil: asOptionalString(row.accessUntil),
      referrer: asOptionalString(row.referrer),
      utmSource: asOptionalString(row.utmSource),
      utmMedium: asOptionalString(row.utmMedium),
      utmCampaign: asOptionalString(row.utmCampaign),
    };
  });
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, filters.pageSize ?? 50);
  const hasBackendPagination = isRecord(record.participants);
  const participantPage = isRecord(record.participants) ? record.participants : {};
  const pagedParticipants = hasBackendPagination
    ? participants
    : participants.slice((page - 1) * pageSize, page * pageSize);
  const total = asNumber(participantPage.total, participants.length);
  const funnel = isRecord(record.funnel) ? record.funnel : {};
  const analytics = isRecord(record.analytics) ? record.analytics : {};
  const attribution = Array.isArray(analytics.attribution) ? analytics.attribution : [];

  return {
    campaignId: asString(record.campaignId ?? campaign.id),
    campaignName: asString(record.campaignName ?? campaign.name, 'Кампания'),
    purpose: campaign.purpose,
    courseId: campaign.courseId,
    courseTitle: asString(
      record.courseTitle ?? campaignWire.courseTitle,
      campaign.courseId ? `Курс ${campaign.courseId}` : 'Курс',
    ),
    funnel: {
      landings: asNumber(funnel.landings ?? funnel.views),
      verified: asNumber(funnel.verified ?? funnel.verifiedEmails),
      activated: asNumber(funnel.activated ?? funnel.activations),
      inProgress: asNumber(
        funnel.inProgress,
        participants.filter((row) => row.progressStatus === 'in_progress').length,
      ),
      completed: asNumber(funnel.completed ?? funnel.completions),
      expired: asNumber(
        funnel.expired,
        participants.filter((row) => row.accessStatus === 'expired').length,
      ),
    },
    participants: {
      items: pagedParticipants,
      page: asNumber(participantPage.page, page),
      pageSize: asNumber(participantPage.pageSize, pageSize),
      total,
      totalPages: asNumber(participantPage.totalPages, Math.max(1, Math.ceil(total / pageSize))),
    },
    analytics:
      Object.keys(analytics).length > 0
        ? {
            firstLessonStarts: asNumber(analytics.firstLessonStarts),
            lessonCompletions: asNumber(analytics.lessonCompletions),
            quizSubmissions: asNumber(analytics.quizSubmissions),
            expiredEnrollments: asNumber(analytics.expiredEnrollments),
            returnVisits: asNumber(analytics.returnVisits),
            averageProgressPercent: asNumber(analytics.averageProgressPercent),
            medianProgressPercent: asNumber(analytics.medianProgressPercent),
            averageCompletionSeconds: asOptionalNumber(analytics.averageCompletionSeconds),
            medianCompletionSeconds: asOptionalNumber(analytics.medianCompletionSeconds),
          }
        : undefined,
    utmBreakdown: attribution.flatMap((item) => {
      if (!isRecord(item)) return [];
      return [
        {
          source: asOptionalString(item.utmSource),
          medium: asOptionalString(item.utmMedium),
          campaign: asOptionalString(item.utmCampaign),
          count: asNumber(item.visits),
        },
      ];
    }),
  };
}

export function normalizeExternalLearnerSummary(wire: unknown): ExternalLearnerSummary {
  const record = isRecord(wire) ? wire : {};
  const firstName = asOptionalString(record.firstName);
  const lastName = asOptionalString(record.lastName);
  const displayName =
    asOptionalString(record.displayName) ??
    (firstName || lastName ? [firstName, lastName].filter(Boolean).join(' ') : undefined);
  return {
    id: asString(record.id),
    email: asString(record.email),
    displayName,
    companyId: asString(record.companyId),
    firstSeenAt: asString(record.firstSeenAt ?? record.createdAt),
    lastActivityAt: asOptionalString(record.lastActivityAt ?? record.updatedAt),
    enrollmentCount: asNumber(record.enrollmentCount),
    completedCount: asNumber(record.completedCount),
  };
}

export function normalizeLearnerTimeline(wire: unknown): ExternalLearnerTimelineNode[] {
  const record = isRecord(wire) ? wire : {};
  if (Array.isArray(record.timeline)) {
    return record.timeline as ExternalLearnerTimelineNode[];
  }
  if (Array.isArray(wire)) {
    return (wire as unknown[]).map((item, index) => normalizeTimelineNode(item, index));
  }
  const events = Array.isArray(record.events) ? record.events : [];
  const byEnrollment = new Map<string, ExternalLearnerTimelineNode>();
  for (const event of events) {
    if (!isRecord(event)) continue;
    const enrollmentId = asOptionalString(event.enrollmentId);
    if (!enrollmentId) continue;
    const existing = byEnrollment.get(enrollmentId);
    const purpose = mapAccessPurpose(event.sourceType ?? event.purpose ?? existing?.purpose);
    const node: ExternalLearnerTimelineNode = {
      enrollmentId,
      courseId: asOptionalString(event.courseId) ?? existing?.courseId,
      courseTitle: asOptionalString(event.courseTitle) ?? existing?.courseTitle ?? 'Курс',
      purpose,
      progressStatus: progressStatusFromWire(
        event.progressStatus ??
          (event.type === 'course_completed' ? 'completed' : existing?.progressStatus),
      ),
      accessStatus: accessStatusFromWire(event.accessStatus ?? existing?.accessStatus),
      percent: asNumber(
        event.progressPercent ?? event.percent ?? existing?.percent,
        existing?.percent ?? 0,
      ),
      activatedAt:
        event.type === 'activated' ? asOptionalString(event.occurredAt) : existing?.activatedAt,
      completedAt:
        event.type === 'course_completed'
          ? asOptionalString(event.occurredAt)
          : existing?.completedAt,
      courseDeleted: event.deletedCourse === true || existing?.courseDeleted,
      campaignId:
        purpose === 'personal'
          ? existing?.campaignId
          : (asOptionalString(event.sourceId) ?? existing?.campaignId),
    };
    byEnrollment.set(enrollmentId, existing ? { ...existing, ...node } : node);
  }
  return [...byEnrollment.values()];
}

function normalizeTimelineNode(item: unknown, index: number): ExternalLearnerTimelineNode {
  const record = isRecord(item) ? item : {};
  return {
    enrollmentId: asString(record.enrollmentId ?? record.id, `enrollment-${index + 1}`),
    courseId: asOptionalString(record.courseId),
    courseTitle: asString(record.courseTitle, 'Курс'),
    purpose: mapAccessPurpose(record.purpose ?? record.sourceType),
    progressStatus: progressStatusFromWire(record.progressStatus),
    accessStatus: accessStatusFromWire(record.accessStatus),
    percent: asNumber(record.percent ?? record.progressPercent),
    activatedAt: asOptionalString(record.activatedAt),
    completedAt: asOptionalString(record.completedAt),
    accessUntil: asOptionalString(record.accessUntil),
    courseDeleted: record.courseDeleted === true || record.deletedCourse === true,
    campaignId: asOptionalString(record.campaignId),
    campaignName: asOptionalString(record.campaignName),
  };
}

export function normalizeExternalLearnerDetail(
  learnerWire: unknown,
  timelineWire?: unknown,
): ExternalLearnerDetail {
  const summary = normalizeExternalLearnerSummary(learnerWire);
  return {
    ...summary,
    timeline: normalizeLearnerTimeline(timelineWire ?? learnerWire),
  };
}

export function paginateArray<T>(
  items: T[],
  filters: { page?: number; pageSize?: number } = {},
): {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
} {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  return {
    items,
    page,
    pageSize,
    total: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / pageSize) || 1),
  };
}
