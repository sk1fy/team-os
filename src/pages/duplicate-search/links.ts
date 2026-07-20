const TEST_AMOCRM_ORIGIN = 'https://demorkrs.amocrm.ru';

/**
 * Временный адаптер ссылок для тестового аккаунта demorkrs.
 * Удалить фиксированный origin после появления домена amoCRM в контексте компании.
 */
export function toAmoCrmCardUrl(link?: string): string {
  if (!link) return '';

  try {
    return new URL(link, TEST_AMOCRM_ORIGIN).toString();
  } catch {
    return '';
  }
}

export function amoCrmCardId(link?: string): string {
  const url = toAmoCrmCardUrl(link);
  return url.match(/\/detail\/(\d+)(?:\/|$)/)?.[1] ?? '';
}
