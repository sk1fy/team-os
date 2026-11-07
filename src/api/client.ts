import { API_URL } from './config';
import { useAuthStore } from '@/stores/auth';
import type { components } from './generated/teamos';

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

/**
 * Auth transport mode for gateway requests.
 * - internal: Bearer from auth store + cookie refresh on 401
 * - external: cookies only (external learner session), never internal Bearer/refresh
 * - none: no Bearer, no internal refresh (public pre-session endpoints)
 */
export type AuthMode = 'internal' | 'external' | 'none';

export interface HttpRequestOptions {
  authMode?: AuthMode;
  /**
   * @deprecated Prefer authMode. Mapped to authMode 'none' when true and authMode omitted.
   * Не пытаться обновить access-токен после 401.
   */
  skipAuthRefresh?: boolean;
  /** Explicit override; defaults true only for authMode internal. */
  retryInternalRefresh?: boolean;
}

export interface AuthSession<TUser> extends Pick<
  components['schemas']['AuthResponse'],
  'accessToken' | 'sessionId' | 'entryContext'
> {
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

function resolveAuthMode(options: HttpRequestOptions): AuthMode {
  if (options.authMode) return options.authMode;
  // Backward-compatible mapping for call sites that only set skipAuthRefresh.
  if (options.skipAuthRefresh) return 'none';
  return 'internal';
}

function requestHeaders(init: RequestInit, authMode: AuthMode): Headers {
  const headers = new Headers(init.headers);
  // Never attach internal TeamOS Bearer outside authMode=internal.
  if (authMode === 'internal') {
    const token = useAuthStore.getState().accessToken;
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
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
    payload?.requestId ??
    response.headers.get('x-request-id') ??
    response.headers.get('X-Request-Id') ??
    undefined;
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

export type RefreshOutcome =
  | { kind: 'ready' }
  | { kind: 'signed-out' }
  | { kind: 'superseded' }
  | { kind: 'unavailable'; error: ApiError };

type AuthIntent =
  | { kind: 'active'; epoch: string; sessionId: string; logoutEpoch: string | null }
  | { kind: 'signed-out'; epoch: string };

export const AUTH_INTENT_KEY = 'teamos.auth.intent';
const LOGOUT_KEY = 'teamos.auth.logout';
const ROUTE_PREFIX = 'teamos.auth.route.';
const PENDING_PREFIX = 'teamos.auth.pending.';
const AUTH_LOCK = 'teamos.auth.mutation';
let memoryIntent: AuthIntent = {
  kind: 'active',
  epoch: 'initial',
  sessionId: 'legacy',
  logoutEpoch: null,
};
let logoutIntent: Extract<AuthIntent, { kind: 'signed-out' }> | null = null;
const pendingRoutes = new Set<string>();
const persistedPendingRoutes = new Set<string>();
const sessionEpochs = new WeakMap<object, string>();
let observedEpoch = memoryIntent.epoch;
let localQueue = Promise.resolve();
let refreshSlot: { epoch: string; promise: Promise<RefreshOutcome> } | undefined;

function isSessionId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    (value === 'legacy' ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
  );
}

function parseIntent(raw: string | null): AuthIntent | null {
  if (!raw) return null;
  const value: unknown = JSON.parse(raw);
  if (
    typeof value !== 'object' ||
    value === null ||
    !('epoch' in value) ||
    typeof value.epoch !== 'string' ||
    !('kind' in value)
  )
    return null;
  if (value.kind === 'signed-out') return { kind: 'signed-out', epoch: value.epoch };
  if (value.kind === 'active' && 'sessionId' in value && isSessionId(value.sessionId)) {
    const logoutEpoch =
      'logoutEpoch' in value && typeof value.logoutEpoch === 'string' ? value.logoutEpoch : null;
    return { kind: 'active', epoch: value.epoch, sessionId: value.sessionId, logoutEpoch };
  }
  return null;
}

function readIntent(): AuthIntent {
  try {
    memoryIntent = parseIntent(localStorage.getItem(AUTH_INTENT_KEY)) ?? memoryIntent;
    const marker = parseIntent(localStorage.getItem(LOGOUT_KEY));
    if (marker?.kind === 'signed-out') logoutIntent = marker;
    if (memoryIntent.kind === 'active') {
      const route = localStorage.getItem(ROUTE_PREFIX + memoryIntent.epoch);
      if (isSessionId(route)) memoryIntent = { ...memoryIntent, sessionId: route };
    }
  } catch {
    /* Storage may be unavailable in embedded browsers. */
  }
  // A response cannot overwrite this independent logout marker, even if logout
  // races the final read/write of a new entry intent in another browser process.
  if (
    logoutIntent &&
    (memoryIntent.kind === 'active'
      ? memoryIntent.logoutEpoch !== logoutIntent.epoch
      : memoryIntent.epoch !== logoutIntent.epoch)
  ) {
    return logoutIntent;
  }
  return memoryIntent;
}

function publishIntent(intent: AuthIntent): void {
  memoryIntent = intent;
  observedEpoch = intent.epoch;
  try {
    localStorage.setItem(AUTH_INTENT_KEY, JSON.stringify(intent));
  } catch {
    /* Memory-only fallback. */
  }
  useAuthStore.getState().invalidateSession(readIntent().epoch);
}

function markSignedOut(): void {
  logoutIntent = { kind: 'signed-out', epoch: crypto.randomUUID() };
  try {
    localStorage.setItem(LOGOUT_KEY, JSON.stringify(logoutIntent));
  } catch {
    /* Memory-only fallback. */
  }
  publishIntent(logoutIntent);
  useAuthStore.getState().clear();
}

function isPendingRoute(value: unknown): value is string {
  return value === 'unresolved' || isSessionId(value);
}

function addPendingRoute(sessionId: string): void {
  pendingRoutes.add(sessionId);
  try {
    localStorage.setItem(PENDING_PREFIX + sessionId, 'pending');
    persistedPendingRoutes.add(sessionId);
  } catch {
    /* Memory-only fallback. */
  }
}

function readPendingRoutes(): string[] {
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key?.startsWith(PENDING_PREFIX)) {
        const route = key.slice(PENDING_PREFIX.length);
        if (isPendingRoute(route)) {
          pendingRoutes.add(route);
          persistedPendingRoutes.add(route);
        }
      }
    }
    for (const route of pendingRoutes) {
      if (
        persistedPendingRoutes.has(route) &&
        localStorage.getItem(PENDING_PREFIX + route) === null
      ) {
        pendingRoutes.delete(route);
        persistedPendingRoutes.delete(route);
      }
    }
  } catch {
    /* Memory-only fallback. */
  }
  return [...pendingRoutes];
}

function removePendingRoute(route: string): void {
  pendingRoutes.delete(route);
  persistedPendingRoutes.delete(route);
  try {
    localStorage.removeItem(PENDING_PREFIX + route);
  } catch {
    /* Memory-only fallback. */
  }
}

function requirePersistentStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const key = ROUTE_PREFIX + 'probe-' + crypto.randomUUID();
    localStorage.setItem(key, key);
    if (localStorage.getItem(key) !== key) throw superseded();
    localStorage.removeItem(key);
  } catch {
    throw new ApiError('Для проверки доступа разрешите хранение данных сайта в браузере.', 503, {
      code: 'AUTH_STORAGE_UNAVAILABLE',
    });
  }
}

export function assertCurrentSession(session: AuthSession<unknown>): void {
  const epoch = sessionEpochs.get(session);
  if (epoch !== undefined) assertAuthEpoch(epoch);
}

function synchronizeIntent(): void {
  const intent = readIntent();
  if (intent.epoch !== observedEpoch) {
    useAuthStore.getState().invalidateSession(intent.epoch);
  } else if (intent.kind === 'signed-out') useAuthStore.getState().clear();
  observedEpoch = intent.epoch;
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === AUTH_INTENT_KEY || event.key === LOGOUT_KEY) synchronizeIntent();
  });
  window.addEventListener('online', () => {
    void retryPendingLogout().catch(() => undefined);
  });
  synchronizeIntent();
  if (readIntent().kind === 'signed-out') {
    void retryPendingLogout().catch(() => undefined);
  }
}

export function captureAuthEpoch(): string {
  synchronizeIntent();
  return readIntent().epoch;
}

function superseded(): ApiError {
  return new ApiError('Сессия изменилась. Повторите действие.', 409, { code: 'AUTH_SUPERSEDED' });
}

export function assertAuthEpoch(epoch: string): void {
  if (readIntent().epoch !== epoch) throw superseded();
}

function mutationLock<T>(operation: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(AUTH_LOCK, operation);
  }
  const result = localQueue.then(operation);
  localQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function unavailable(error: unknown): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError('Не удалось связаться с сервером. Попробуйте ещё раз.', 503, {
        code: 'AUTH_UNAVAILABLE',
      });
}

function validateSession<TUser>(session: AuthSession<TUser>): void {
  if (
    typeof session !== 'object' ||
    session === null ||
    typeof session.accessToken !== 'string' ||
    !session.accessToken ||
    typeof session.user !== 'object' ||
    session.user === null ||
    !('id' in session.user) ||
    typeof session.user.id !== 'string' ||
    !session.user.id ||
    (session.sessionId !== undefined && !isSessionId(session.sessionId))
  ) {
    throw unavailable(undefined);
  }
}

function commitSession<TUser>(session: AuthSession<TUser>, epoch: string): void {
  assertAuthEpoch(epoch);
  validateSession(session);
  const intent = readIntent();
  if (intent.kind !== 'active') throw superseded();
  if (session.sessionId) {
    try {
      localStorage.setItem(ROUTE_PREFIX + epoch, session.sessionId);
    } catch {
      /* Memory-only fallback. */
    }
    memoryIntent = { ...intent, sessionId: session.sessionId };
  }
  assertAuthEpoch(epoch);
  sessionEpochs.set(session, epoch);
  useAuthStore.getState().setAccessToken(session.accessToken);
  // Recheck after the memory commit too, since another process can publish a
  // logout between our last storage read and this synchronous store write.
  if (readIntent().epoch !== epoch) {
    useAuthStore.getState().clear();
    throw superseded();
  }
}

async function finishPendingLogout(): Promise<void> {
  for (const sessionId of readPendingRoutes()) {
    const response = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: sessionId === 'unresolved' ? undefined : { 'X-Teamos-Session': sessionId },
    });
    if (!response.ok) throw await responseError(response);
    await response.arrayBuffer();
    removePendingRoute(sessionId);
  }
}

export function retryPendingLogout(): Promise<void> {
  return mutationLock(finishPendingLogout);
}

export function logoutSession(): Promise<void> {
  const previous = readIntent();
  if (previous.kind === 'active')
    addPendingRoute(
      previous.epoch === 'initial' && previous.sessionId === 'legacy'
        ? 'unresolved'
        : previous.sessionId,
    );
  markSignedOut();
  return retryPendingLogout();
}

/** Web Locks are required for explicit cookie creation across browser tabs. */
export function establishSession<TSession extends AuthSession<unknown>>(
  request: () => Promise<TSession>,
): Promise<TSession> {
  const epoch = captureAuthEpoch();
  return mutationLock(async () => {
    assertAuthEpoch(epoch);
    if (typeof window !== 'undefined' && !navigator.locks) {
      throw new ApiError('Для входа откройте приложение в современном браузере.', 503, {
        code: 'AUTH_COORDINATION_UNAVAILABLE',
      });
    }
    requirePersistentStorage();
    await finishPendingLogout();
    assertAuthEpoch(epoch);
    const nextEpoch = crypto.randomUUID();
    const acknowledgedLogout = logoutIntent?.epoch ?? null;
    const previous = readIntent();
    try {
      const session = await request();
      validateSession(session);
      if (readIntent().epoch !== epoch) {
        if (session.sessionId) addPendingRoute(session.sessionId);
        throw superseded();
      }
      publishIntent({
        kind: 'active',
        epoch: nextEpoch,
        sessionId: session.sessionId ?? 'legacy',
        logoutEpoch: acknowledgedLogout,
      });
      commitSession(session, nextEpoch);
      useAuthStore.getState().setInitialized(true);
      return session;
    } catch (error) {
      if (readIntent().epoch === nextEpoch && previous.kind === 'signed-out') {
        markSignedOut();
      }
      throw error;
    }
  });
}

export function refreshSession(): Promise<RefreshOutcome> {
  const intent = readIntent();
  if (intent.kind === 'signed-out') {
    void retryPendingLogout().catch(() => undefined);
    return Promise.resolve({ kind: 'signed-out' });
  }
  if (refreshSlot?.epoch === intent.epoch) return refreshSlot.promise;
  const promise = mutationLock(async (): Promise<RefreshOutcome> => {
    if (readIntent().epoch !== intent.epoch) return { kind: 'superseded' };
    try {
      requirePersistentStorage();
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        // No route has been observed on the first load. Let the gateway read
        // its HttpOnly selector, then retain the returned nonsecret sessionId.
        headers:
          intent.epoch === 'initial' && intent.sessionId === 'legacy'
            ? undefined
            : { 'X-Teamos-Session': intent.sessionId },
      });
      if (!response.ok) {
        const error = await responseError(response);
        if (readIntent().epoch !== intent.epoch) return { kind: 'superseded' };
        if (response.status === 401) {
          markSignedOut();
          return { kind: 'signed-out' };
        }
        return { kind: 'unavailable', error };
      }
      const session: AuthSession<unknown> = await response.json();
      validateSession(session);
      if (readIntent().epoch !== intent.epoch) {
        if (readIntent().kind === 'signed-out' && session.sessionId) {
          addPendingRoute(session.sessionId);
          if (intent.epoch === 'initial') removePendingRoute('unresolved');
        }
        return { kind: 'superseded' };
      }
      commitSession(session, intent.epoch);
      return { kind: 'ready' };
    } catch (error) {
      if (readIntent().epoch !== intent.epoch) return { kind: 'superseded' };
      return { kind: 'unavailable', error: unavailable(error) };
    }
  }).catch((error): RefreshOutcome => ({ kind: 'unavailable', error: unavailable(error) }));
  refreshSlot = { epoch: intent.epoch, promise };
  void promise.finally(() => {
    if (refreshSlot?.promise === promise) refreshSlot = undefined;
  });
  return promise;
}

export async function refreshAccessToken(): Promise<boolean> {
  return (await refreshSession()).kind === 'ready';
}

async function authenticatedResponse(
  execute: () => Promise<Response>,
  retry: boolean,
): Promise<Response> {
  const epoch = captureAuthEpoch();
  const token = useAuthStore.getState().accessToken;
  let response = await execute();
  if (retry) assertAuthEpoch(epoch);
  if (response.status !== 401 || !retry) return response;
  assertAuthEpoch(epoch);
  if (!useAuthStore.getState().accessToken || useAuthStore.getState().accessToken === token) {
    const outcome = await refreshSession();
    if (outcome.kind === 'signed-out') return response;
    assertAuthEpoch(epoch);
    if (outcome.kind === 'unavailable') throw outcome.error;
    if (outcome.kind !== 'ready') throw superseded();
  }
  assertAuthEpoch(epoch);
  response = await execute();
  assertAuthEpoch(epoch);
  return response;
}

/**
 * HTTP-клиент gateway: authMode, cookie/bearer, ApiError и refresh только
 * для internal auth.
 */
export async function httpRequest<T>(
  path: string,
  init: RequestInit = {},
  options: HttpRequestOptions = {},
): Promise<T> {
  const authMode = resolveAuthMode(options);
  const epoch = authMode === 'internal' ? captureAuthEpoch() : null;
  const retryInternalRefresh =
    options.retryInternalRefresh ?? (authMode === 'internal' && !options.skipAuthRefresh);

  const requestUrl = path.startsWith('/api/')
    ? /^https?:\/\//i.test(API_URL)
      ? new URL(path, API_URL).toString()
      : path
    : `${API_URL}${path}`;

  const execute = () =>
    fetch(requestUrl, {
      ...init,
      // external/none rely on HttpOnly cookies when the browser has them;
      // never attach internal Authorization for those modes.
      credentials: 'include',
      headers: requestHeaders(init, authMode),
    });

  const response = await authenticatedResponse(execute, retryInternalRefresh);
  if (epoch !== null) assertAuthEpoch(epoch);
  if (!response.ok) throw await responseError(response);
  if (response.status === 204) return undefined as T;
  const result: T = await response.json();
  if (epoch !== null) assertAuthEpoch(epoch);
  return result;
}

/**
 * Binary variant of the authenticated gateway client.
 * Keeps the same auth/refresh/error semantics as httpRequest, but does not
 * attempt to decode successful responses as JSON.
 */
export async function httpBlobRequest(
  path: string,
  init: RequestInit = {},
  options: HttpRequestOptions = {},
): Promise<Blob> {
  const authMode = resolveAuthMode(options);
  const epoch = authMode === 'internal' ? captureAuthEpoch() : null;
  const retryInternalRefresh =
    options.retryInternalRefresh ?? (authMode === 'internal' && !options.skipAuthRefresh);

  const execute = () =>
    fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: requestHeaders(init, authMode),
    });

  const response = await authenticatedResponse(execute, retryInternalRefresh);
  if (epoch !== null) assertAuthEpoch(epoch);
  if (!response.ok) throw await responseError(response);
  const result = await response.blob();
  if (epoch !== null) assertAuthEpoch(epoch);
  return result;
}

export function jsonBody(value: unknown): string {
  return JSON.stringify(value);
}

/** Открывает авторизованный SSE-поток; AbortSignal закрывает соединение. */
export async function openEventStream(path: string, signal: AbortSignal): Promise<Response> {
  const epoch = captureAuthEpoch();
  const execute = () =>
    fetch(`${API_URL}${path}`, {
      credentials: 'include',
      headers: requestHeaders({ headers: { Accept: 'text/event-stream' } }, 'internal'),
      signal,
    });
  const response = await authenticatedResponse(execute, true);
  assertAuthEpoch(epoch);
  if (!response.ok) throw await responseError(response);
  const reader = response.body?.getReader();
  if (!reader) return response;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        assertAuthEpoch(epoch);
        const chunk = await reader.read();
        assertAuthEpoch(epoch);
        if (chunk.done) controller.close();
        else controller.enqueue(chunk.value);
      } catch (error) {
        await reader.cancel().catch(() => undefined);
        controller.error(error);
      }
    },
    cancel: () => reader.cancel(),
  });
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
