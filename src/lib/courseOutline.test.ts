import { describe, expect, it } from 'vitest';
import { DEFAULT_SECTION_TITLE, outlineStats, parseCourseOutline } from './courseOutline';

describe('parseCourseOutline', () => {
  it('разбирает заголовки и уроки', () => {
    expect(
      parseCourseOutline('# Введение\nЧто такое TeamOS\n- Роли и права\n# Практика\nПервая задача'),
    ).toEqual([
      { title: 'Введение', lessons: ['Что такое TeamOS', 'Роли и права'] },
      { title: 'Практика', lessons: ['Первая задача'] },
    ]);
  });

  it('складывает уроки без заголовка в раздел по умолчанию', () => {
    expect(parseCourseOutline('Урок один\nУрок два')).toEqual([
      { title: DEFAULT_SECTION_TITLE, lessons: ['Урок один', 'Урок два'] },
    ]);
  });

  it('игнорирует пустые строки и лишние пробелы', () => {
    expect(parseCourseOutline('\n  # Раздел  \n\n   Урок   \n\n')).toEqual([
      { title: 'Раздел', lessons: ['Урок'] },
    ]);
  });

  it('подставляет имя разделу без названия', () => {
    expect(parseCourseOutline('#\nУрок')).toEqual([{ title: 'Раздел 1', lessons: ['Урок'] }]);
  });

  it('сохраняет раздел без уроков', () => {
    expect(parseCourseOutline('# Пустой')).toEqual([{ title: 'Пустой', lessons: [] }]);
  });

  it('возвращает пустой план для пустого текста', () => {
    expect(parseCourseOutline('   \n\n')).toEqual([]);
  });
});

describe('outlineStats', () => {
  it('считает разделы и уроки', () => {
    expect(outlineStats(parseCourseOutline('# А\nУрок\nУрок\n# Б\nУрок'))).toEqual({
      sections: 2,
      lessons: 3,
    });
  });
});
