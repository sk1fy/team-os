import { describe, expect, it } from 'vitest';
import { normalizeNewLessonTitle } from './newLessonDraft';

describe('new lesson draft', () => {
  it('does not allow an empty server-side lesson to be created', () => {
    expect(normalizeNewLessonTitle('   \n ')).toBeNull();
  });

  it('normalizes the title before the lesson is persisted', () => {
    expect(normalizeNewLessonTitle('  Первый   урок  ')).toBe('Первый урок');
  });
});
