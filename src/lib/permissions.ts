import type { UserRole } from '@/types';

export const employeeHomePath = '/schedule';

const employeeRoutes = [
  '/schedule',
  '/knowledge',
  '/academy',
  '/notifications',
  '/settings',
  '/learn/',
  '/share/article/',
] as const;

export function canAccessRoute(role: UserRole | undefined, pathname: string) {
  if (role !== 'employee') return true;
  return employeeRoutes.some((route) =>
    route.endsWith('/')
      ? pathname.startsWith(route)
      : pathname === route || pathname.startsWith(`${route}/`),
  );
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
