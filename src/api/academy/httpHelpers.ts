import { httpRequest, jsonBody } from '@/api/client';

export function encodeId(value: string): string {
  return encodeURIComponent(value);
}

export function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
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
};

function headers(options?: RequestOptions): HeadersInit | undefined {
  if (!options?.idempotencyKey) return undefined;
  return { 'Idempotency-Key': options.idempotencyKey };
}

export function academyGet<T>(path: string, options?: RequestOptions): Promise<T> {
  return httpRequest<T>(path, {
    method: 'GET',
    signal: options?.signal,
    headers: headers(options),
  });
}

export function academyMutate<T>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  return httpRequest<T>(path, {
    method,
    body: body === undefined ? undefined : jsonBody(body),
    signal: options?.signal,
    headers: headers(options),
  });
}

/** Public/external requests never attach internal auth refresh preference for learner tokens. */
export function externalGet<T>(path: string, options?: RequestOptions): Promise<T> {
  return httpRequest<T>(
    path,
    { method: 'GET', signal: options?.signal, headers: headers(options) },
    { skipAuthRefresh: true },
  );
}

export function externalMutate<T>(
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
      headers: headers(options),
    },
    { skipAuthRefresh: true },
  );
}
