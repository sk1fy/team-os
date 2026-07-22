import { API_URL } from './config';
import { useAuthStore } from '@/stores/auth';

// В тестах задержки и случайные ошибки отключены, иначе тесты мок-API флакают.
const IS_TEST = import.meta.env.MODE === 'test';
const MIN_DELAY_MS = IS_TEST ? 0 : 300;
const MAX_DELAY_MS = IS_TEST ? 0 : 500;
const ERROR_RATE = IS_TEST ? 0 : 0.05;

/** Ошибка API — сетевая/серверная ошибка с опциональным structured code. */
export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  requestId?: string;

  constructor(
    message = 'Что-то пошло не так. Попробуйте ещё раз.',
    status = 500,
    options?: { code?: string; details?: unknown; requestId?: string },
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = options?.code;
    this.details = options?.details;
    this.requestId = options?.requestId;
  }
}

function randomDelay() {
  return MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
}

export interface MockRequestOptions {
  /** Отключить случайные ошибки (для критичных запросов вроде текущего пользователя). */
  noFail?: boolean;
}

interface ErrorResponse {
  error?: {
    message?: string;
    status?: number;
    code?: string;
    details?: unknown;
  };
  code?: string;
  details?: unknown;
  requestId?: string;
}

export interface HttpRequestOptions {
  /** Не пытаться обновить access-токен после 401 (для login/refresh и публичных ручек). */
  skipAuthRefresh?: boolean;
}

export interface AuthSession<TUser> {
  accessToken: string;
  user: TUser;
}

export async function mockRequest<T>(
  resolve: () => T,
  options: MockRequestOptions = {},
): Promise<T> {
  await new Promise((r) => setTimeout(r, randomDelay()));
  if (!options.noFail && Math.random() < ERROR_RATE) {
    throw new ApiError();
  }
  // structuredClone защищает in-memory «базу» от мутаций из компонентов.
  return structuredClone(resolve());
}

/** 404 для запросов по id. */
export function notFound(entity: string): never {
  throw new ApiError(`${entity} не найден`, 404);
}

function requestHeaders(init: RequestInit): Headers {
  const headers = new Headers(init.headers);
  const token = useAuthStore.getState().accessToken;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body !== undefined && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return headers;
}

async function responseError(response: Response): Promise<ApiError> {
  let payload: ErrorResponse | undefined;
  try {
    payload = (await response.json()) as ErrorResponse;
  } catch {
    // Ответ прокси или сети может быть не в JSON-формате.
  }
  const requestId =
    payload?.requestId ?? response.headers.get('x-request-id') ?? response.headers.get('X-Request-Id') ?? undefined;
  return new ApiError(
    payload?.error?.message ?? 'Что-то пошло не так. Попробуйте ещё раз.',
    payload?.error?.status ?? response.status,
    {
      code: payload?.error?.code ?? payload?.code,
      details: payload?.error?.details ?? payload?.details,
      requestId: requestId ?? undefined,
    },
  );
}

let refreshPromise: Promise<boolean> | null = null;

/** Ротация refresh-cookie с защитой от параллельных refresh-запросов. */
export function refreshAccessToken<TUser>(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (response) => {
        if (!response.ok) {
          useAuthStore.getState().clear();
          return false;
        }
        const session = (await response.json()) as AuthSession<TUser>;
        useAuthStore.getState().setAccessToken(session.accessToken);
        return true;
      })
      .catch(() => {
        useAuthStore.getState().clear();
        return false;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/**
 * HTTP-клиент gateway: cookie, bearer-токен, ApiError и одна прозрачная
 * попытка refresh после 401.
 */
export async function httpRequest<T>(
  path: string,
  init: RequestInit = {},
  options: HttpRequestOptions = {},
): Promise<T> {
  const execute = () =>
    fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: requestHeaders(init),
    });

  let response = await execute();
  if (response.status === 401 && !options.skipAuthRefresh && (await refreshAccessToken())) {
    response = await execute();
  }
  if (!response.ok) throw await responseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function jsonBody(value: unknown): string {
  return JSON.stringify(value);
}

/** Открывает авторизованный SSE-поток; AbortSignal закрывает соединение. */
export async function openEventStream(path: string, signal: AbortSignal): Promise<Response> {
  const execute = () =>
    fetch(`${API_URL}${path}`, {
      credentials: 'include',
      headers: requestHeaders({ headers: { Accept: 'text/event-stream' } }),
      signal,
    });
  let response = await execute();
  if (response.status === 401 && (await refreshAccessToken())) response = await execute();
  if (!response.ok) throw await responseError(response);
  return response;
}
