import type { User } from '@/types';

export function validateInviteEmail(email: string, users: User[]): string | null {
  const normalized = email.trim().toLowerCase();
  const duplicate = users.find((user) => user.email.toLowerCase() === normalized);
  if (duplicate && duplicate.status !== 'deactivated') {
    return 'Сотрудник с таким email уже есть в компании';
  }
  return null;
}
