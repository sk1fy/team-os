const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export const RAKURS_ACTIVITY_API_URL = trimTrailingSlash(
  import.meta.env.VITE_RAKURS_ACTIVITY_API_URL ?? 'https://ssd.rkrs.ru/api/v1/rkrs_activity',
);

export const RAKURS_DUPLICATES_API_URL = trimTrailingSlash(
  import.meta.env.VITE_RAKURS_DUPLICATES_API_URL ?? 'https://ssd.rkrs.ru/api/v1/rkrs_duplicates_v2',
);

export const RAKURS_ACCOUNT_API_URL = trimTrailingSlash(
  import.meta.env.VITE_RAKURS_ACCOUNT_API_URL ?? 'https://ssd.rkrs.ru/api/account',
);

export interface RakursContext {
  accountId: string;
  appName: 'rkrs_activity' | 'rkrs_duplicates_v2';
}

export class RakursApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'RakursApiError';
  }
}

function endpointUrl(baseUrl: string, endpoint: string) {
  return `${trimTrailingSlash(baseUrl)}/${endpoint.replace(/^\/+/, '')}`;
}

async function parseResponse<T>(response: Response): Promise<T> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new RakursApiError(
      response.ok ? 'Сервис вернул некорректный ответ' : `Ошибка сервиса (${response.status})`,
      response.status,
    );
  }

  if (!response.ok) {
    const record =
      payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    const message =
      typeof record.message === 'string' ? record.message : `Ошибка сервиса (${response.status})`;
    throw new RakursApiError(message, response.status, payload);
  }

  if (
    payload &&
    typeof payload === 'object' &&
    (payload as Record<string, unknown>).response === 'error'
  ) {
    const message = (payload as Record<string, unknown>).message;
    throw new RakursApiError(
      typeof message === 'string' ? message : 'Сервис не смог выполнить запрос',
      response.status,
      payload,
    );
  }

  return payload as T;
}

/** POST к текущим API Rakurs. Идентификатор аккаунта добавляется централизованно. */
export async function rakursPost<T>(
  baseUrl: string,
  endpoint: string,
  context: RakursContext,
  body: Record<string, unknown> = {},
  signal?: AbortSignal,
): Promise<T> {
  if (!context.accountId.trim()) {
    throw new RakursApiError('В настройках компании не указан amoCRM Account ID', 400);
  }

  try {
    const response = await fetch(endpointUrl(baseUrl, endpoint), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...body,
        amo_account_id: context.accountId,
        app_name: context.appName,
      }),
      signal,
    });
    return await parseResponse<T>(response);
  } catch (error) {
    if (
      error instanceof RakursApiError ||
      (error instanceof DOMException && error.name === 'AbortError')
    ) {
      throw error;
    }
    throw new RakursApiError('Не удалось подключиться к сервису Rakurs', undefined, error);
  }
}

/** GET к служебным endpoint текущего Rakurs API. */
export async function rakursGet<T>(url: string, signal?: AbortSignal): Promise<T> {
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal });
    return await parseResponse<T>(response);
  } catch (error) {
    if (
      error instanceof RakursApiError ||
      (error instanceof DOMException && error.name === 'AbortError')
    ) {
      throw error;
    }
    throw new RakursApiError('Не удалось подключиться к сервису Rakurs', undefined, error);
  }
}
