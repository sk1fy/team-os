import { describe, expect, it } from 'vitest';
import { amoCrmCardId, toAmoCrmCardUrl } from './links';

describe('amoCRM card links', () => {
  it.each([
    ['/contacts/detail/38410509', 'https://demorkrs.amocrm.ru/contacts/detail/38410509'],
    ['/companies/detail/17', 'https://demorkrs.amocrm.ru/companies/detail/17'],
    ['/leads/detail/42', 'https://demorkrs.amocrm.ru/leads/detail/42'],
  ])('добавляет домен тестового аккаунта к пути %s', (path, expected) => {
    expect(toAmoCrmCardUrl(path)).toBe(expected);
  });

  it('сохраняет уже абсолютную ссылку', () => {
    expect(toAmoCrmCardUrl('https://example.amocrm.ru/contacts/detail/5')).toBe(
      'https://example.amocrm.ru/contacts/detail/5',
    );
  });

  it('извлекает идентификатор карточки из ссылки', () => {
    expect(amoCrmCardId('/contacts/detail/38410509')).toBe('38410509');
    expect(amoCrmCardId()).toBe('');
  });
});
