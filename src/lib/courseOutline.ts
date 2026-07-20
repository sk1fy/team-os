/**
 * Разбор плана курса из простого текста — основа конструктора Академии Opus.
 *
 * Базовая Академия собирает структуру кликами: раздел, урок, раздел, урок.
 * Здесь можно вставить готовый план одним куском текста, а конструктор
 * превратит его в разделы и уроки:
 *
 *   # Введение          → раздел
 *   Что такое TeamOS    → урок этого раздела
 *   - Роли и права      → урок (дефис в начале отбрасывается)
 *
 * Строки до первого заголовка попадают в раздел по умолчанию, поэтому
 * простой список уроков без заголовков тоже работает.
 */

export interface OutlineSection {
  title: string;
  lessons: string[];
}

/** Название раздела, если план начинается сразу с уроков. */
export const DEFAULT_SECTION_TITLE = 'Основной раздел';

/** Строка урока может начинаться с маркера списка — убираем его. */
function stripBullet(line: string): string {
  return line.replace(/^[-*•]\s+/, '').trim();
}

export function parseCourseOutline(text: string): OutlineSection[] {
  const sections: OutlineSection[] = [];

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('#')) {
      const title = line.replace(/^#+\s*/, '').trim();
      sections.push({ title: title || `Раздел ${sections.length + 1}`, lessons: [] });
      continue;
    }

    const lesson = stripBullet(line);
    if (!lesson) continue;
    if (sections.length === 0) sections.push({ title: DEFAULT_SECTION_TITLE, lessons: [] });
    sections[sections.length - 1].lessons.push(lesson);
  }

  return sections;
}

/** Сводка для кнопки «Создать курс · N уроков». */
export function outlineStats(sections: OutlineSection[]) {
  return {
    sections: sections.length,
    lessons: sections.reduce((sum, section) => sum + section.lessons.length, 0),
  };
}
