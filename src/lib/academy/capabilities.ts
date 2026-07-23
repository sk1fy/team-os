import type { UserRole } from '@/types';
import type {
  AcademyCourseSummary,
  CourseDistributionStatus,
  CourseLifecycleStatus,
  CourseOwnerType,
  CourseUiCapabilities,
} from '@/types/academy';

export interface CapabilityContext {
  role: UserRole;
  userId: string;
  course: Pick<
    AcademyCourseSummary,
    'ownerType' | 'ownerUserId' | 'lifecycleStatus' | 'distributionStatus' | 'draftVersion' | 'latestPublishedVersion'
  > & {
    capabilities?: Partial<CourseUiCapabilities>;
  };
}

const emptyCaps: CourseUiCapabilities = {
  canEditDraft: false,
  canPublish: false,
  canArchive: false,
  canRestore: false,
  canDelete: false,
  canAssignInternally: false,
  canCreateCandidateCampaign: false,
  canCreatePersonalAccess: false,
  canCreatePromoCampaign: false,
  canViewInternalReports: false,
  canViewExternalReports: false,
  canCopyToCompany: false,
  canPauseDistribution: false,
  canBlock: false,
  canResolveRestriction: false,
};

function isCompanyManager(role: UserRole): boolean {
  return role === 'owner' || role === 'admin';
}

function isOwnPartnerCourse(
  role: UserRole,
  userId: string,
  ownerType: CourseOwnerType,
  ownerUserId?: string,
): boolean {
  return role === 'partner' && ownerType === 'partner' && ownerUserId === userId;
}

/**
 * Temporary client-side capability selector until backend always returns
 * CourseUiCapabilities. Backend 403 remains the source of truth.
 */
export function resolveCourseCapabilities(ctx: CapabilityContext): CourseUiCapabilities {
  const { role, userId, course } = ctx;
  const backend = course.capabilities ?? {};
  const lifecycle: CourseLifecycleStatus = course.lifecycleStatus;
  const distribution: CourseDistributionStatus = course.distributionStatus;
  const isDeleted = lifecycle === 'deleted';
  const isArchived = lifecycle === 'archived';
  const isActive = lifecycle === 'active';
  const hasDraft = Boolean(course.draftVersion);
  const hasPublished = Boolean(course.latestPublishedVersion);

  const ownPartner = isOwnPartnerCourse(role, userId, course.ownerType, course.ownerUserId);
  const companyCourse = course.ownerType === 'company';
  const partnerCourse = course.ownerType === 'partner';
  const manager = isCompanyManager(role);

  let resolved: CourseUiCapabilities = { ...emptyCaps };

  if (isDeleted) {
    // Only reporting remains conceptually; UI capabilities false.
    if (manager && companyCourse) {
      resolved.canViewInternalReports = true;
      resolved.canViewExternalReports = true;
    }
    if (ownPartner) {
      resolved.canViewExternalReports = true;
    }
  } else if (manager && companyCourse) {
    resolved = {
      ...emptyCaps,
      canEditDraft: isActive || isArchived,
      canPublish: (isActive || isArchived) && hasDraft,
      canArchive: isActive,
      canRestore: isArchived,
      canDelete: !isDeleted,
      canAssignInternally: isActive && hasPublished,
      canCreateCandidateCampaign: isActive && hasPublished && distribution === 'active',
      canViewInternalReports: true,
      canViewExternalReports: true,
      canCopyToCompany: false,
      canPauseDistribution: false,
      canBlock: false,
      canResolveRestriction: false,
      canCreatePersonalAccess: false,
      canCreatePromoCampaign: false,
    };
  } else if (manager && partnerCourse) {
    // Read-only oversight of partner original
    resolved = {
      ...emptyCaps,
      canEditDraft: false,
      canPublish: false,
      canArchive: false,
      canRestore: false,
      canDelete: false,
      canAssignInternally: false,
      canCreateCandidateCampaign: false,
      canCreatePersonalAccess: false,
      canCreatePromoCampaign: false,
      canViewInternalReports: false,
      canViewExternalReports: true,
      canCopyToCompany: hasPublished && !isDeleted,
      canPauseDistribution: isActive && distribution === 'active',
      canBlock: isActive && distribution !== 'blocked',
      canResolveRestriction: distribution === 'paused' || distribution === 'blocked',
    };
  } else if (ownPartner) {
    resolved = {
      ...emptyCaps,
      canEditDraft: isActive || isArchived,
      canPublish: (isActive || isArchived) && hasDraft,
      canArchive: isActive,
      canRestore: isArchived,
      canDelete: !isDeleted,
      canAssignInternally: false,
      canCreateCandidateCampaign: false,
      canCreatePersonalAccess: isActive && hasPublished && distribution === 'active',
      canCreatePromoCampaign: isActive && hasPublished && distribution === 'active',
      canViewInternalReports: false,
      canViewExternalReports: true,
      canCopyToCompany: false,
      canPauseDistribution: false,
      canBlock: false,
      canResolveRestriction: false,
    };
  } else if (role === 'employee' || role === 'partner') {
    // Learner on company catalog course — no management
    resolved = { ...emptyCaps };
  }

  // Backend capabilities override local inference when present (true/false explicitly).
  return {
    canEditDraft: backend.canEditDraft ?? resolved.canEditDraft,
    canPublish: backend.canPublish ?? resolved.canPublish,
    canArchive: backend.canArchive ?? resolved.canArchive,
    canRestore: backend.canRestore ?? resolved.canRestore,
    canDelete: backend.canDelete ?? resolved.canDelete,
    canAssignInternally: backend.canAssignInternally ?? resolved.canAssignInternally,
    canCreateCandidateCampaign:
      backend.canCreateCandidateCampaign ?? resolved.canCreateCandidateCampaign,
    canCreatePersonalAccess: backend.canCreatePersonalAccess ?? resolved.canCreatePersonalAccess,
    canCreatePromoCampaign: backend.canCreatePromoCampaign ?? resolved.canCreatePromoCampaign,
    canViewInternalReports: backend.canViewInternalReports ?? resolved.canViewInternalReports,
    canViewExternalReports: backend.canViewExternalReports ?? resolved.canViewExternalReports,
    canCopyToCompany: backend.canCopyToCompany ?? resolved.canCopyToCompany,
    canPauseDistribution: backend.canPauseDistribution ?? resolved.canPauseDistribution,
    canBlock: backend.canBlock ?? resolved.canBlock,
    canResolveRestriction: backend.canResolveRestriction ?? resolved.canResolveRestriction,
  };
}

export function canManageAcademyCourses(role: UserRole | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'partner';
}

export function canViewPartnerCourses(role: UserRole | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export function canManageCompanyTemplates(role: UserRole | undefined): boolean {
  return role === 'owner' || role === 'admin';
}
