import { describe, expect, it } from 'vitest';
import { coursePreviewDocumentTitle } from './coursePreviewDocumentTitle';

describe('coursePreviewDocumentTitle', () => {
  it('includes the loaded course title and preview context', () => {
    expect(coursePreviewDocumentTitle('QA Эффективные встречи 28.07.2026')).toBe(
      'QA Эффективные встречи 28.07.2026 — Предпросмотр — TeamOS',
    );
  });

  it('uses a meaningful fallback while course data is unavailable', () => {
    expect(coursePreviewDocumentTitle()).toBe('Предпросмотр курса — TeamOS');
    expect(coursePreviewDocumentTitle('   ')).toBe('Предпросмотр курса — TeamOS');
  });
});
