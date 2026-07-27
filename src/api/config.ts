export type ApiModule =
  'auth' | 'org' | 'kb' | 'tasks' | 'academy' | 'notifications' | 'schedule' | 'distribution';

const API_MODES: Record<ApiModule, string | undefined> = {
  auth: import.meta.env.VITE_API_MODE_AUTH,
  org: import.meta.env.VITE_API_MODE_ORG,
  kb: import.meta.env.VITE_API_MODE_KB,
  tasks: import.meta.env.VITE_API_MODE_TASKS,
  academy: import.meta.env.VITE_API_MODE_ACADEMY,
  notifications: import.meta.env.VITE_API_MODE_NOTIFICATIONS,
  schedule: import.meta.env.VITE_API_MODE_SCHEDULE,
  distribution: import.meta.env.VITE_API_MODE_DISTRIBUTION,
};

/** По умолчанию моки остаются доступным офлайн-демо. */
export function isHttpApiMode(module: ApiModule): boolean {
  return API_MODES[module]?.toLowerCase() === 'http';
}

export function resolveApiUrl(
  configuredUrl: string | undefined,
  options: { isProduction: boolean; pageProtocol?: string },
): string {
  const fallbackUrl = options.isProduction ? '/api/v1' : 'http://localhost:8080/api/v1';
  const candidate = configuredUrl?.trim() || fallbackUrl;

  // HTTPS-страница не может обращаться к HTTP API. В production gateway
  // публикуется через тот же origin, поэтому сохраняем только путь API.
  if (options.pageProtocol === 'https:' && /^http:\/\//i.test(candidate)) {
    try {
      return new URL(candidate).pathname.replace(/\/$/, '') || '/api/v1';
    } catch {
      return '/api/v1';
    }
  }

  return candidate.replace(/\/$/, '');
}

export const API_URL = resolveApiUrl(import.meta.env.VITE_API_URL, {
  isProduction: import.meta.env.PROD,
  pageProtocol: typeof window === 'undefined' ? undefined : window.location.protocol,
});
