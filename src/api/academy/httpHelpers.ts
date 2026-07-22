import { httpRequest, jsonBody, type AuthMode } from '@/api/client';

export function encodeId(value: string): string {
  return encodeURIComponent(value);
}

export function buildQuery(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export type RequestOptions = {
  signal?: AbortSignal;
  idempotencyKey?: string;
  authMode?: AuthMode;
};

function mergeHeaders(options?: RequestOptions): HeadersInit | undefined {
  if (!options?.idempotencyKey) return undefined;
  return { 'Idempotency-Key': options.idempotencyKey };
}

/** Internal TeamOS academy API — Bearer + refresh. */
export function academyGet<T>(path: string, options?: RequestOptions): Promise<T> {
  return httpRequest<T>(
    path,
    {
      method: 'GET',
      signal: options?.signal,
      headers: mergeHeaders(options),
    },
    { authMode: options?.authMode ?? 'internal' },
  );
}

export function academyMutate<T>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  return httpRequest<T>(
    path,
    {
      method,
      body: body === undefined ? undefined : jsonBody(body),
      signal: options?.signal,
      headers: mergeHeaders(options),
    },
    { authMode: options?.authMode ?? 'internal' },
  );
}

/**
 * Public/external academy transport.
 * authMode external: session cookies only — never internal Bearer.
 * Use authMode none for pre-session landing/verification when no learner session exists.
 */
export function externalGet<T>(
  path: string,
  options?: RequestOptions & { authMode?: 'external' | 'none' },
): Promise<T> {
  return httpRequest<T>(
    path,
    {
      method: 'GET',
      signal: options?.signal,
      headers: mergeHeaders(options),
    },
    { authMode: options?.authMode ?? 'external', retryInternalRefresh: false },
  );
}

export function externalMutate<T>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
  options?: RequestOptions & { authMode?: 'external' | 'none' },
): Promise<T> {
  return httpRequest<T>(
    path,
    {
      method,
      body: body === undefined ? undefined : jsonBody(body),
      signal: options?.signal,
      headers: mergeHeaders(options),
    },
    { authMode: options?.authMode ?? 'external', retryInternalRefresh: false },
  );
}
