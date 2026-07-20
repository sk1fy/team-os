import { describe, expect, it } from 'vitest';
import { createDefaultRuleSettings, normalizeDuplicateSettings } from './duplicates';

describe('legacy duplicates normalizers', () => {
  it('сохраняет неизвестные поля при нормализации настроек', () => {
    const settings = normalizeDuplicateSettings({
      data: {
        legacy_flag: 'keep-me',
        background_search: 'right',
        fields: [{ fields: ['contacts#1#Телефон'], ignore: '+7', condition: 'and' }],
        manager: [{ manager: 42, isUnion: 'old', legacy_row: true }],
        massSearch: {
          contacts: { fields: ['contacts#1#Телефон'], ignore: '', condition: 'or' },
        },
      },
    });

    expect(settings.legacy_flag).toBe('keep-me');
    expect(settings.manager[0]).toMatchObject({
      manager: '42',
      isUnion: 'old',
      legacy_row: true,
    });
    expect(settings.fields[0]).toMatchObject({ condition: 'and', ignore: '+7' });
  });

  it('создаёт API-совместимые ключи условий с кириллической С', () => {
    const rule = createDefaultRuleSettings();

    expect(Object.hasOwn(rule, 'searchСonditionContact')).toBe(true);
    expect(Object.hasOwn(rule, 'searchСonditionCompany')).toBe(true);
    expect(Object.keys(rule.searchСonditionContact)).toEqual(['1', '2', '3']);
  });
});
