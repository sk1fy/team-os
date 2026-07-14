/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_API_MODE_AUTH?: 'http' | 'mock';
  readonly VITE_API_MODE_ORG?: 'http' | 'mock';
  readonly VITE_API_MODE_KB?: 'http' | 'mock';
  readonly VITE_API_MODE_TASKS?: 'http' | 'mock';
  readonly VITE_API_MODE_ACADEMY?: 'http' | 'mock';
  readonly VITE_API_MODE_NOTIFICATIONS?: 'http' | 'mock';
  readonly VITE_API_MODE_SCHEDULE?: 'http' | 'mock';
  readonly VITE_API_MODE_DISTRIBUTION?: 'http' | 'mock';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
