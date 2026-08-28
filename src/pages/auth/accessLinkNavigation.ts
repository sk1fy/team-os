import type { AuthSession } from '@/api/client';

export const COMPANY_CREATED_WELCOME_STATE = {
  showCompanyCreatedWelcome: true,
} as const;

export interface AccessLinkDestination {
  pathname: '/employees' | '/schedule';
  state?: typeof COMPANY_CREATED_WELCOME_STATE;
}

export function getAccessLinkDestination<TUser>(
  session: AuthSession<TUser>,
): AccessLinkDestination {
  if (session.entryContext === 'company_created') {
    return {
      pathname: '/employees',
      state: COMPANY_CREATED_WELCOME_STATE,
    };
  }

  return { pathname: '/schedule' };
}
