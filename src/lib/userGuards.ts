import type { ID, User, UserRole, UserStatus } from '@/types';

export interface UserUpdateInput {
  role?: UserRole;
  status?: UserStatus;
}

export function validatePositionAssignment(positionIds: ID[]): string | null {
  if (positionIds.length > 1) return 'Сотруднику можно назначить только одну должность';
  return null;
}

export function validateUserUpdate(
  user: User,
  input: UserUpdateInput,
  context: { ownerId: string; currentUserId: string },
): string | null {
  const isOwner = user.id === context.ownerId;
  const isSelf = user.id === context.currentUserId;

  if (isOwner) {
    if (input.role !== undefined && input.role !== 'owner') {
      return 'Нельзя изменить роль владельца компании';
    }
    if (input.status !== undefined && input.status !== 'active') {
      return 'Нельзя деактивировать владельца компании';
    }
  }

  if (isSelf && input.role !== undefined && input.role !== user.role) {
    const currentRank = roleRank(user.role);
    const nextRank = roleRank(input.role);
    if (nextRank > currentRank) {
      return 'Нельзя понизить собственную роль';
    }
  }

  if (isSelf && input.status === 'deactivated') {
    return 'Нельзя деактивировать собственный аккаунт';
  }

  return null;
}

function roleRank(role: UserRole): number {
  switch (role) {
    case 'owner':
      return 0;
    case 'admin':
      return 1;
    case 'employee':
      return 2;
    case 'partner':
      return 3;
  }
}
