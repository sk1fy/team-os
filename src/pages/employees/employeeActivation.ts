import type { User } from '@/types';

export function isEmployeeActivationEligible(user: User): boolean {
  return (user.role === 'employee' || user.role === 'admin') && user.status !== 'deactivated';
}

export function countActiveEmployees(users: User[]): number {
  return users.filter((user) => isEmployeeActivationEligible(user) && user.showInSchedule === true)
    .length;
}

export function canActivateEmployee(users: User[], user: User, limit: number): boolean {
  if (!isEmployeeActivationEligible(user)) return false;
  if (user.showInSchedule === true) return true;
  const activeOtherUsers = users.filter(
    (item) =>
      item.id !== user.id && isEmployeeActivationEligible(item) && item.showInSchedule === true,
  ).length;
  return activeOtherUsers < limit;
}
