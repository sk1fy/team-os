import { ApiError, httpBlobRequest, httpRequest, jsonBody, type AuthMode } from '@/api/client';

const MUTATION_TIMEOUT_MS = 20_000;

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

export async function academyMutate<T>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  const timeoutController = new AbortController();
  let timedOut = false;
  const timeout = globalThis.setTimeout(() => {
    timedOut = true;
    timeoutController.abort();
  }, MUTATION_TIMEOUT_MS);
  const abortFromCaller = () => timeoutController.abort(options?.signal?.reason);
  if (options?.signal?.aborted) abortFromCaller();
  else options?.signal?.addEventListener('abort', abortFromCaller, { once: true });

  try {
    return await httpRequest<T>(
      path,
      {
        method,
        body: body === undefined ? undefined : jsonBody(body),
        signal: timeoutController.signal,
        headers: mergeHeaders(options),
      },
      { authMode: options?.authMode ?? 'internal' },
    );
  } catch (error) {
    if (timedOut) {
      throw new ApiError(
        'Сервер не ответил вовремя. Проверьте результат запроса и попробуйте ещё раз.',
        504,
        { code: 'REQUEST_TIMEOUT' },
      );
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
    options?.signal?.removeEventListener('abort', abortFromCaller);
  }
}

/** Internal authenticated file download with the same refresh/error semantics. */
export function academyDownload(path: string, options?: RequestOptions): Promise<Blob> {
  return httpBlobRequest(
    path,
    {
      method: 'GET',
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
