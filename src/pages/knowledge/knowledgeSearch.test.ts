import { describe, expect, it } from 'vitest';
import { createKnowledgeSearchSnippet, splitKnowledgeSearchHighlight } from './knowledgeSearch';

describe('knowledge search presentation', () => {
  it('returns a short excerpt around a body match', () => {
    const text = `${'Начало статьи '.repeat(30)}важный регламент${' продолжение'.repeat(30)}`;
    const snippet = createKnowledgeSearchSnippet(text, 'регламент', 100);

    expect(snippet).toContain('регламент');
    expect(snippet.length).toBeLessThanOrEqual(102);
    expect(snippet.startsWith('…')).toBe(true);
    expect(snippet.endsWith('…')).toBe(true);
  });

  it('normalizes whitespace and shows the beginning when only the title matches', () => {
    const snippet = createKnowledgeSearchSnippet(
      '  Первый\n\nабзац   статьи и продолжение',
      'заголовок',
      20,
    );
    expect(snippet).toBe('Первый абзац статьи…');
  });

  it('marks matches as text parts without producing HTML', () => {
    expect(splitKnowledgeSearchHighlight('<script>Регламент</script>', 'регламент')).toEqual([
      { text: '<script>', highlighted: false },
      { text: 'Регламент', highlighted: true },
      { text: '</script>', highlighted: false },
    ]);
  });
});
