export function isAmoSessionAuthRoute(pathname: string, search = ''): boolean {
  return pathname === '/auth/amocrm' && new URLSearchParams(search).get('mode') === 'session';
}

export function isPublicAuthTokenRoute(pathname: string, search = ''): boolean {
  if (pathname === '/onboarding' || pathname === '/register-company') return true;
  if (pathname !== '/auth/amocrm') return false;

  return !isAmoSessionAuthRoute(pathname, search);
}
