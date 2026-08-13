import { describe, expect, it } from 'vitest';
import { coursePreviewPresentation } from './coursePreviewPresentation';

describe('course preview presentation', () => {
  it('keeps the compact draft label distinct from the published version label', () => {
    expect(coursePreviewPresentation(true).headerLabel).toBe('Черновик · предпросмотр');
    expect(coursePreviewPresentation(false).headerLabel).toBe('Версия · предпросмотр');
  });

  it('preserves the no-progress warning in accessible and visible copy', () => {
    const presentation = coursePreviewPresentation(true);
    expect(presentation.accessibleHeaderLabel).toContain('без сохранения прогресса');
    expect(presentation.statusText).toContain('уроки, тесты и прогресс не сохраняются');
  });
});
