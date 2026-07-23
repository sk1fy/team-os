import type { UserRole } from '@/types';

/** Canonical Academy V2 route paths. */
export const academyRoutes = {
  home: '/academy',
  catalog: '/academy/catalog',
  courses: '/academy/courses',
  course: (courseId: string) => `/academy/courses/${courseId}`,
  builder: (courseId: string) => `/academy/courses/${courseId}/builder`,
  versions: (courseId: string) => `/academy/courses/${courseId}/versions`,
  distribution: (courseId: string) => `/academy/courses/${courseId}/distribution`,
  courseReports: (courseId: string) => `/academy/courses/${courseId}/reports`,
  partners: '/academy/partners',
  partner: (partnerId: string) => `/academy/partners/${partnerId}`,
  templates: '/academy/templates',
  template: (templateId: string) => `/academy/templates/${templateId}`,
  templateBuilder: (templateId: string) => `/academy/templates/${templateId}/builder`,
  reports: '/academy/reports',
  learners: '/academy/learners',
  learner: (learnerId: string) => `/academy/learners/${learnerId}`,
  campaign: (campaignId: string) => `/academy/campaigns/${campaignId}`,
  enrollmentReport: (enrollmentId: string) => `/academy/enrollments/${enrollmentId}/report`,
  learn: (enrollmentId: string) => `/learn/${enrollmentId}`,
  previewVersion: (versionId: string) => `/academy/preview/course-versions/${versionId}`,
  previewDraft: (draftVersionId: string) => `/academy/preview/drafts/${draftVersionId}`,
  externalLanding: (token: string) => `/training/${token}`,
  externalPlayer: (enrollmentId: string) => `/training/enrollments/${enrollmentId}`,
  externalResults: (enrollmentId: string) => `/training/enrollments/${enrollmentId}/results`,
} as const;

export type AcademyNavItemId =
  | 'home'
  | 'catalog'
  | 'courses'
  | 'partners'
  | 'templates'
  | 'reports'
  | 'learners';

export interface AcademyNavItem {
  id: AcademyNavItemId;
  to: string;
  label: string;
  end?: boolean;
}

/**
 * Role-based Academy secondary navigation.
 * Object-level actions are separate (capabilities), not nav.
 */
export function academyNavForRole(role: UserRole | undefined): AcademyNavItem[] {
  if (!role) return [];

  const learner: AcademyNavItem[] = [
    { id: 'home', to: academyRoutes.home, label: 'Моё обучение', end: true },
    { id: 'catalog', to: academyRoutes.catalog, label: 'Каталог' },
  ];

  if (role === 'employee') {
    return learner;
  }

  if (role === 'partner') {
    return [
      ...learner,
      { id: 'courses', to: academyRoutes.courses, label: 'Мои курсы' },
      { id: 'templates', to: academyRoutes.templates, label: 'Шаблоны' },
      { id: 'reports', to: academyRoutes.reports, label: 'Отчёты' },
      { id: 'learners', to: academyRoutes.learners, label: 'Внешние ученики' },
    ];
  }

  // owner / admin
  return [
    ...learner,
    { id: 'courses', to: academyRoutes.courses, label: 'Курсы компании' },
    { id: 'partners', to: academyRoutes.partners, label: 'Курсы партнёров' },
    { id: 'templates', to: academyRoutes.templates, label: 'Шаблоны' },
    { id: 'reports', to: academyRoutes.reports, label: 'Отчёты' },
    { id: 'learners', to: academyRoutes.learners, label: 'Внешние ученики' },
  ];
}

/** Academy sub-route policy (module already allowed). */
export function canAccessAcademyPath(role: UserRole | undefined, pathname: string): boolean {
  if (!role) return false;

  const path = pathname.split('?')[0] ?? pathname;

  // Shared learner paths
  if (path === '/academy' || path.startsWith('/academy/catalog')) return true;
  if (path.startsWith('/learn/')) return true;
  // Preview is authenticated; object-level access is enforced by backend 403
  if (path.startsWith('/academy/preview/')) return true;

  if (role === 'employee') {
    // Employee: only home + catalog + personal learn (+ preview above)
    return false;
  }

  if (role === 'partner') {
    if (path.startsWith('/academy/partners')) return false;
    if (path.startsWith('/academy/courses')) return true;
    // A partner may use templates, but editing company templates is owner/admin-only.
    if (/^\/academy\/templates\/[^/]+\/builder\/?$/.test(path)) return false;
    if (path.startsWith('/academy/templates')) return true;
    if (path.startsWith('/academy/reports')) return true;
    if (path.startsWith('/academy/learners')) return true;
    if (path.startsWith('/academy/campaigns')) return true;
    if (path.startsWith('/academy/enrollments')) return true;
    return false;
  }

  // owner / admin — full academy tree
  if (path.startsWith('/academy/')) return true;
  return false;
}

export const legacyAcademyRedirects: Array<{ from: string; to: string }> = [
  { from: '/academy/:courseId', to: '/academy/courses/:courseId' },
  { from: '/academy-opus', to: '/academy' },
  { from: '/academy-grok', to: '/academy' },
  { from: '/academy-grok/catalog', to: '/academy/catalog' },
  { from: '/academy-grok/reports', to: '/academy/reports' },
];
