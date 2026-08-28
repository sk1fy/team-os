import type { User } from '@/types';

export interface CompanyCreatedWelcomeState {
  showCompanyCreatedWelcome: true;
}

export interface ImportedUsersSummary {
  total: number;
  owners: number;
  admins: number;
  employees: number;
  deactivated: number;
}

export function isCompanyCreatedWelcomeState(
  state: unknown,
): state is CompanyCreatedWelcomeState {
  return (
    typeof state === 'object' &&
    state !== null &&
    'showCompanyCreatedWelcome' in state &&
    state.showCompanyCreatedWelcome === true
  );
}

export function summarizeImportedUsers(users: User[]): ImportedUsersSummary {
  const imported = users.filter((user) => user.source === 'amo');
  const active = imported.filter((user) => user.status === 'active');

  return {
    total: imported.length,
    owners: active.filter((user) => user.role === 'owner').length,
    admins: active.filter((user) => user.role === 'admin').length,
    employees: active.filter((user) => user.role === 'employee').length,
    deactivated: imported.filter((user) => user.status === 'deactivated').length,
  };
}
