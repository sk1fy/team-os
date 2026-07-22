/**
 * Academy V2 domain types.
 * Author/learner DTOs are intentionally separated so correct answers
 * never leak into learner UI.
 */

import type { ID, ISODate, RichTextContent } from './index';

// ---------------------------------------------------------------------------
// Course identity & lifecycle
// ---------------------------------------------------------------------------

export type CourseOwnerType = 'company' | 'partner';
export type CourseLifecycleStatus = 'active' | 'archived' | 'deleted';
export type CourseDistributionStatus = 'active' | 'paused' | 'blocked';
export type CourseVersionStatus = 'draft' | 'published';

export interface CourseUiCapabilities {
  canEditDraft: boolean;
  canPublish: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canDelete: boolean;
  canAssignInternally: boolean;
  canCreateCandidateCampaign: boolean;
  canCreatePersonalAccess: boolean;
  canCreatePromoCampaign: boolean;
  canViewInternalReports: boolean;
  canViewExternalReports: boolean;
  canCopyToCompany: boolean;
  canPauseDistribution: boolean;
  canBlock: boolean;
  canResolveRestriction: boolean;
}

export interface CourseVersionSummary {
  id: ID;
  courseId: ID;
  versionNumber: number;
  status: CourseVersionStatus;
  title: string;
  publishedAt?: ISODate;
  createdAt: ISODate;
  updatedAt: ISODate;
  lessonCount?: number;
  sectionCount?: number;
}

export interface CourseOriginSummary {
  type: 'partner_copy' | 'template' | 'kb_import' | 'manual';
  sourceCourseId?: ID;
  sourceCourseTitle?: string;
  sourceVersionId?: ID;
  sourceVersionNumber?: number;
  sourcePartnerUserId?: ID;
  sourcePartnerName?: string;
  sourceTemplateId?: ID;
  sourceTemplateTitle?: string;
  copiedAt?: ISODate;
}

export interface AcademyCourseSummary {
  id: ID;
  ownerType: CourseOwnerType;
  ownerUserId?: ID;
  ownerDisplayName?: string;
  title: string;
  description?: string;
  coverUrl?: string;
  lifecycleStatus: CourseLifecycleStatus;
  distributionStatus: CourseDistributionStatus;
  latestPublishedVersion?: CourseVersionSummary;
  draftVersion?: CourseVersionSummary;
  origin?: CourseOriginSummary;
  capabilities: CourseUiCapabilities;
  updatedAt: ISODate;
  createdAt: ISODate;
}

export interface AcademyCourseDetail extends AcademyCourseSummary {
  sequential: boolean;
  deadlineDays?: number;
  visibility: 'public' | 'company' | 'restricted';
  restrictionReason?: string;
  restrictedAt?: ISODate;
  restrictedByUserId?: ID;
  restrictedByName?: string;
}

// ---------------------------------------------------------------------------
// Author content (builder)
// ---------------------------------------------------------------------------

export interface QuizOptionAuthor {
  id: ID;
  text: string;
  correct: boolean;
}

export interface QuizQuestionAuthor {
  id: ID;
  type: 'single' | 'multiple' | 'open';
  text: string;
  options: QuizOptionAuthor[];
}

export interface QuizAuthor {
  id: ID;
  lessonId: ID;
  questions: QuizQuestionAuthor[];
  passingScore: number;
  maxAttempts?: number;
}

export interface LessonAuthor {
  id: ID;
  courseId: ID;
  sectionId: ID;
  versionId: ID;
  title: string;
  order: number;
  content: RichTextContent;
  sourceArticleId?: ID;
  sourceMode?: 'link' | 'copy';
  quiz?: QuizAuthor;
  estimatedMinutes?: number;
}

export interface SectionAuthor {
  id: ID;
  courseId: ID;
  versionId: ID;
  title: string;
  order: number;
  lessons: LessonAuthor[];
}

export interface CourseVersionAuthorDetail {
  id: ID;
  courseId: ID;
  versionNumber: number;
  status: CourseVersionStatus;
  title: string;
  description?: string;
  sequential: boolean;
  deadlineDays?: number;
  sections: SectionAuthor[];
  publishedAt?: ISODate;
  createdAt: ISODate;
  updatedAt: ISODate;
}

// ---------------------------------------------------------------------------
// Learner content (player) — no correct answers
// ---------------------------------------------------------------------------

export interface QuizOptionLearner {
  id: ID;
  text: string;
}

export interface QuizQuestionLearner {
  id: ID;
  type: 'single' | 'multiple' | 'open';
  text: string;
  options: QuizOptionLearner[];
}

export interface QuizLearner {
  id: ID;
  lessonId: ID;
  questions: QuizQuestionLearner[];
  passingScore: number;
  maxAttempts?: number;
  attemptsUsed?: number;
}

export interface LessonLearner {
  id: ID;
  courseId: ID;
  sectionId: ID;
  versionId: ID;
  title: string;
  order: number;
  content: RichTextContent;
  quiz?: QuizLearner;
  estimatedMinutes?: number;
  /** Server-resolved: locked until previous lessons complete when sequential. */
  locked: boolean;
  completed: boolean;
}

export interface SectionLearner {
  id: ID;
  title: string;
  order: number;
  lessons: Array<{
    id: ID;
    title: string;
    order: number;
    locked: boolean;
    completed: boolean;
    hasQuiz: boolean;
  }>;
}

export interface CourseVersionLearnerDetail {
  id: ID;
  courseId: ID;
  versionNumber: number;
  title: string;
  description?: string;
  sequential: boolean;
  sections: SectionLearner[];
}

// ---------------------------------------------------------------------------
// Enrollment
// ---------------------------------------------------------------------------

export type LearnerType = 'user' | 'external';

export type EnrollmentAccessStatus =
  | 'invited'
  | 'ready'
  | 'active'
  | 'expired'
  | 'frozen'
  | 'suspended'
  | 'revoked'
  | 'closed';

export type EnrollmentProgressStatus = 'not_started' | 'in_progress' | 'completed';

export interface EnrollmentSummary {
  id: ID;
  courseId: ID;
  courseVersionId: ID;
  courseTitle: string;
  courseCoverUrl?: string;
  learnerType: LearnerType;
  progressStatus: EnrollmentProgressStatus;
  accessStatus: EnrollmentAccessStatus;
  percent: number;
  completedLessons: number;
  totalLessons: number;
  currentLessonId?: ID;
  activatedAt?: ISODate;
  accessUntil?: ISODate;
  dueDate?: ISODate;
  startedAt?: ISODate;
  completedAt?: ISODate;
  lastActivityAt?: ISODate;
  assignmentId?: ID;
  campaignId?: ID;
}

export interface EnrollmentDetail extends EnrollmentSummary {
  outline: CourseVersionLearnerDetail;
  canCompleteLessons: boolean;
  canSubmitQuiz: boolean;
  isPreview: boolean;
  stateMessage?: string;
}

export interface QuizAttemptAnswer {
  questionId: ID;
  selectedOptionIds?: ID[];
  openText?: string;
}

export interface QuizQuestionFeedback {
  questionId: ID;
  correct: boolean;
  selectedOptionIds?: ID[];
  correctOptionIds?: ID[];
  explanation?: string;
}

export interface QuizAttemptResult {
  attemptId: ID;
  quizId: ID;
  enrollmentId: ID;
  score: number;
  passed: boolean;
  pendingReview: boolean;
  attemptsUsed: number;
  maxAttempts?: number;
  feedback: QuizQuestionFeedback[];
  createdAt: ISODate;
}

// ---------------------------------------------------------------------------
// Catalog & management lists
// ---------------------------------------------------------------------------

export interface CatalogCourseCard {
  id: ID;
  title: string;
  description?: string;
  coverUrl?: string;
  lessonCount: number;
  estimatedMinutes?: number;
  latestVersionNumber?: number;
  enrolled?: boolean;
  enrollmentId?: ID;
  progressPercent?: number;
}

export interface MyLearningSummary {
  continueEnrollment?: EnrollmentSummary;
  stats: {
    inProgress: number;
    completed: number;
    overdue: number;
    totalAssigned: number;
  };
  enrollments: EnrollmentSummary[];
}

export type AcademyListSort =
  | 'updated_desc'
  | 'updated_asc'
  | 'title_asc'
  | 'title_desc'
  | 'deadline_asc'
  | 'status';

export interface AcademyListFilters {
  q?: string;
  lifecycleStatus?: CourseLifecycleStatus | 'all';
  distributionStatus?: CourseDistributionStatus | 'all';
  ownerType?: CourseOwnerType | 'all';
  page?: number;
  pageSize?: number;
  sort?: AcademyListSort;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export type TemplateOwnerType = 'system' | 'company';

export interface AcademyTemplateSummary {
  id: ID;
  ownerType: TemplateOwnerType;
  title: string;
  description?: string;
  coverUrl?: string;
  category?: string;
  lessonCount?: number;
  latestVersionNumber?: number;
  /** Published template version id required for instantiate. */
  latestVersionId?: ID;
  archived?: boolean;
  capabilities: {
    canInstantiate: boolean;
    canEdit: boolean;
    canArchive: boolean;
    canPreview: boolean;
  };
}

// ---------------------------------------------------------------------------
// Reports (server read models)
// ---------------------------------------------------------------------------

export type InternalReportRowStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'overdue'
  | 'frozen';

export interface InternalReportRow {
  enrollmentId?: ID;
  userId: ID;
  userName: string;
  departmentName?: string;
  positionName?: string;
  courseId: ID;
  courseTitle: string;
  status: InternalReportRowStatus;
  percent: number;
  completedLessons: number;
  totalLessons: number;
  dueDate?: ISODate;
  startedAt?: ISODate;
  completedAt?: ISODate;
  lastActivityAt?: ISODate;
}

export interface InternalReportResult extends PaginatedResult<InternalReportRow> {
  filtersApplied: Record<string, string | number | boolean | undefined>;
}

// ---------------------------------------------------------------------------
// Assignments / distribution (internal)
// ---------------------------------------------------------------------------

export type AssignmentTargetType = 'user' | 'position' | 'department';

export interface CourseAssignmentSummary {
  id: ID;
  courseId: ID;
  courseVersionId: ID;
  targetType: AssignmentTargetType;
  targetId: ID;
  targetName?: string;
  dueDate?: ISODate;
  assignedById: ID;
  assignedByName?: string;
  createdAt: ISODate;
  activeEnrollments: number;
  completedEnrollments: number;
}

// ---------------------------------------------------------------------------
// Structured error codes used by Academy UI
// ---------------------------------------------------------------------------

export type AcademyErrorCode =
  | 'COURSE_ARCHIVED'
  | 'COURSE_DELETED'
  | 'COURSE_BLOCKED'
  | 'DISTRIBUTION_PAUSED'
  | 'ACCESS_REVOKED'
  | 'ACCESS_EXPIRED'
  | 'EMAIL_MISMATCH'
  | 'VERIFICATION_EXPIRED'
  | 'VERIFICATION_RATE_LIMITED'
  | 'ENROLLMENT_ALREADY_EXISTS'
  | 'VERSION_CONFLICT'
  | 'PUBLISH_VALIDATION_FAILED'
  | 'DRAFT_CONFLICT';
