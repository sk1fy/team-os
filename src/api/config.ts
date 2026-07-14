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

export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1').replace(
  /\/$/,
  '',
);
