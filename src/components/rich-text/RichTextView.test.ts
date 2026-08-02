import { describe, expect, it } from 'vitest';
import { readOnlyRichTextAttributes } from './readOnlyRichText';

describe('RichTextView accessibility', () => {
  it('exposes read-only content as an article rather than an editable textbox', () => {
    expect(readOnlyRichTextAttributes.role).toBe('article');
    expect(readOnlyRichTextAttributes.role).not.toBe('textbox');
  });
});
