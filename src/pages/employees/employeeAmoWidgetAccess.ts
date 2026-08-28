import type { User } from '@/types';

/**
 * amoCRM administrators receive widget entry from their TeamOS role rather than
 * from a manually issued personal access link.
 */
export function hasAmoWidgetAccess(user: User): boolean {
  return user.source === 'amo' && user.role === 'admin' && user.status === 'active';
}
