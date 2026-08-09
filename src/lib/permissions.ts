import type { EmployeeSection, UserRole } from '@/types';
import { canAccessAcademyPath } from '@/lib/academy/routes';
import { isAcademyV2Enabled } from '@/lib/academy/featureFlag';

export const employeeHomePath = '/schedule';

/** A destination that is guaranteed to be available to the role. */
export const defaultEmployeeSections: EmployeeSection[] = ['schedule', 'knowledge', 'academy'];

export function safeHomePath(
  role: UserRole | undefined,
  sectionAccess?: EmployeeSection[],
): string {
  if (role === 'employee') {
    const sections = sectionAccess ?? defaultEmployeeSections;
    const firstAvailable = sections[0];
    if (firstAvailable === 'knowledge') return '/knowledge';
    if (firstAvailable === 'academy') return '/academy';
    if (firstAvailable === 'distribution') return '/distribution';
    if (firstAvailable === 'schedule') return employeeHomePath;
    return '/settings';
  }
  if (role === 'partner') return '/academy';
  if (role === 'owner' || role === 'admin') return '/dashboard';
  return '/auth/login';
}

/**
 * Preserve an originally requested protected page only when the authenticated
 * role may open it. Otherwise send the user to the role-specific landing page.
 */
export function resolvePostLoginPath(
  role: UserRole | undefined,
  requestedPath?: string,
  sectionAccess?: EmployeeSection[],
): string {
  if (requestedPath && canAccessRoute(role, requestedPath, sectionAccess)) {
    return requestedPath;
  }
  return safeHomePath(role, sectionAccess);
}

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
  if (pathname === '/' || pathname === '' || pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname.startsWith('/employees') || pathname.startsWith('/structure')) return 'employees';
  if (pathname.startsWith('/schedule')) return 'schedule';
  if (pathname.startsWith('/tasks')) return 'tasks';
  if (pathname.startsWith('/distribution')) return 'distribution';
  if (pathname.startsWith('/knowledge') || pathname.startsWith('/share/article/'))
    return 'knowledge';
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
export function canAccessRoute(
  role: UserRole | undefined,
  pathname: string,
  sectionAccess?: EmployeeSection[],
) {
  if (!role) return false;

  if (role === 'owner' || role === 'admin') return true;

  if (role === 'employee') {
    const allowedSections = sectionAccess ?? defaultEmployeeSections;
    if (pathname === '/distribution' || pathname.startsWith('/distribution/')) {
      return allowedSections.includes('distribution');
    }
    // Keep legacy experimental academy routes until cutover.
    if (!isAcademyV2Enabled()) {
      if (!matchesPrefixList(pathname, legacyEmployeeRoutes)) return false;
      if (
        pathname.startsWith('/academy') ||
        pathname.startsWith('/learn') ||
        pathname.startsWith('/academy-opus') ||
        pathname.startsWith('/academy-grok') ||
        pathname.startsWith('/learn-opus') ||
        pathname.startsWith('/learn-grok')
      ) {
        return allowedSections.includes('academy');
      }
      if (pathname.startsWith('/schedule')) return allowedSections.includes('schedule');
      if (pathname.startsWith('/knowledge') || pathname.startsWith('/share/article/')) {
        return allowedSections.includes('knowledge');
      }
      return true;
    }
    const module = moduleForPath(pathname);
    if (!module) return false;
    if (module === 'schedule' || module === 'knowledge' || module === 'academy') {
      if (!allowedSections.includes(module)) return false;
    } else if (module === 'distribution') {
      return allowedSections.includes('distribution');
    } else if (!canAccessModule(role, module)) {
      return false;
    }
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

/**
 * Protected routes fail closed while the current user is unknown.
 * This keeps privileged page chrome and data queries out of the first render.
 */
export function protectedRouteState(
  role: UserRole | undefined,
  pathname: string,
  sectionAccess: EmployeeSection[] | undefined,
  queryState: { isPending: boolean; isError: boolean },
): 'checking' | 'allowed' | 'denied' {
  if (queryState.isPending) return 'checking';
  if (queryState.isError || !role) return 'denied';
  return canAccessRoute(role, pathname, sectionAccess) ? 'allowed' : 'denied';
}

export function canManageContent(role: UserRole | undefined) {
  return role === 'owner' || role === 'admin';
}

export function canManageAccess(role: UserRole | undefined) {
  return role === 'owner' || role === 'admin';
}

export function canManageIntegrations(role: UserRole | undefined) {
  return role === 'owner' || role === 'admin';
}
