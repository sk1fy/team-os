import type { UserRole } from '@/types';
import { canAccessAcademyPath } from '@/lib/academy/routes';
import { isAcademyV2Enabled } from '@/lib/academy/featureFlag';

export const employeeHomePath = '/schedule';

/** Explicit module matrix — never “allow all if not employee”. */
export type AppModule =
  | 'dashboard'
  | 'employees'
  | 'structure'
  | 'schedule'
  | 'tasks'
  | 'distribution'
  | 'knowledge'
  | 'academy'
  | 'notifications'
  | 'profile'
  | 'settings'
  | 'integrations';

const moduleAccess: Record<UserRole, AppModule[] | '*'> = {
  owner: '*',
  admin: '*',
  employee: ['schedule', 'knowledge', 'academy', 'notifications', 'profile', 'settings'],
  partner: ['knowledge', 'academy', 'notifications', 'profile', 'settings'],
};

export function modulesForRole(role: UserRole | undefined): AppModule[] | '*' {
  if (!role) return [];
  return moduleAccess[role];
}

export function canAccessModule(role: UserRole | undefined, module: AppModule): boolean {
  const access = modulesForRole(role);
  if (access === '*') return true;
  return access.includes(module);
}

/** Map pathname prefix to product module. */
export function moduleForPath(pathname: string): AppModule | null {
  if (pathname === '/' || pathname === '') return 'dashboard';
  if (pathname.startsWith('/employees') || pathname.startsWith('/structure')) return 'employees';
  if (pathname.startsWith('/schedule')) return 'schedule';
  if (pathname.startsWith('/tasks')) return 'tasks';
  if (pathname.startsWith('/distribution')) return 'distribution';
  if (pathname.startsWith('/knowledge') || pathname.startsWith('/share/article/')) return 'knowledge';
  if (
    pathname.startsWith('/academy') ||
    pathname.startsWith('/learn') ||
    pathname.startsWith('/learn-opus') ||
    pathname.startsWith('/learn-grok')
  ) {
    return 'academy';
  }
  if (pathname.startsWith('/notifications')) return 'notifications';
  if (pathname.startsWith('/settings')) return 'settings';
  if (pathname.startsWith('/activity-control') || pathname.startsWith('/duplicate-search')) {
    return 'integrations';
  }
  return null;
}

const legacyEmployeeRoutes = [
  '/schedule',
  '/knowledge',
  '/academy',
  '/academy-opus',
  '/academy-grok',
  '/notifications',
  '/settings',
  '/learn/',
  '/learn-opus/',
  '/learn-grok/',
  '/share/article/',
] as const;

function matchesPrefixList(pathname: string, routes: readonly string[]): boolean {
  return routes.some((route) =>
    route.endsWith('/')
      ? pathname.startsWith(route)
      : pathname === route || pathname.startsWith(`${route}/`),
  );
}

/**
 * Route-level access. Partner and employee use explicit matrices;
 * owner/admin get full product access (integrations still gated separately).
 */
export function canAccessRoute(role: UserRole | undefined, pathname: string) {
  if (!role) return false;

  if (role === 'owner' || role === 'admin') return true;

  if (role === 'employee') {
    // Keep legacy experimental academy routes until cutover.
    if (!isAcademyV2Enabled()) {
      return matchesPrefixList(pathname, legacyEmployeeRoutes);
    }
    const module = moduleForPath(pathname);
    if (!module || !canAccessModule(role, module)) return false;
    if (module === 'academy') {
      // Employee may still open legacy experiment paths until Phase 9 cutover.
      if (
        pathname.startsWith('/academy-opus') ||
        pathname.startsWith('/academy-grok') ||
        pathname.startsWith('/learn-opus') ||
        pathname.startsWith('/learn-grok')
      ) {
        return true;
      }
      return canAccessAcademyPath(role, pathname);
    }
    return true;
  }

  if (role === 'partner') {
    const module = moduleForPath(pathname);
    if (!module || !canAccessModule(role, module)) return false;
    if (module === 'academy') {
      if (
        pathname.startsWith('/academy-opus') ||
        pathname.startsWith('/academy-grok') ||
        pathname.startsWith('/learn-opus') ||
        pathname.startsWith('/learn-grok')
      ) {
        return true;
      }
      if (isAcademyV2Enabled()) {
        return canAccessAcademyPath(role, pathname);
      }
      // Legacy: partner could open academy experiments like non-employees historically.
      return pathname.startsWith('/academy') || pathname.startsWith('/learn');
    }
    return true;
  }

  return false;
}

export function canManageContent(role: UserRole | undefined) {
  return role === 'owner' || role === 'admin';
}

export function canManageAccess(role: UserRole | undefined) {
  return role === 'owner';
}

export function canManageIntegrations(role: UserRole | undefined) {
  return role === 'owner' || role === 'admin';
}
