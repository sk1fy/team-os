/**
 * Мок-клиент API.
 *
 * Все функции запросов проходят через mockRequest: искусственная задержка
 * 300–500 мс и 5% случайных ошибок, чтобы интерфейс с первого дня
 * проектировался под состояния загрузки и фейлы. При подключении реального
 * бэкенда меняется только реализация функций в src/api/* — компоненты
 * работают через TanStack Query и ничего не заметят.
 */

const MIN_DELAY_MS = 300;
const MAX_DELAY_MS = 500;
const ERROR_RATE = 0.05;

/** Ошибка мок-API — аналог сетевой/серверной ошибки. */
export class ApiError extends Error {
  constructor(
    message = 'Что-то пошло не так. Попробуйте ещё раз.',
    public status = 500,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function randomDelay() {
  return MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
}

export interface MockRequestOptions {
  /** Отключить случайные ошибки (для критичных запросов вроде текущего пользователя). */
  noFail?: boolean;
}

export async function mockRequest<T>(resolve: () => T, options: MockRequestOptions = {}): Promise<T> {
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
