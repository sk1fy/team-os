import { describe, expect, it } from 'vitest';
import type { RichTextContent } from '@/types';
import { replaceFileImageSources, richTextFileIds } from './fileImages';

const content: RichTextContent = {
  type: 'doc',
  content: [
    {
      type: 'image',
      attrs: {
        src: 'https://expired.example/old',
        alt: 'Схема',
        fileId: 'file-1',
      },
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Текст' }],
    },
  ],
};

describe('rich-text file images', () => {
  it('extracts stable file ownership ids', () => {
    expect(richTextFileIds(content)).toEqual(['file-1']);
  });

  it('refreshes only the render URL and preserves the stable file id', () => {
    const resolved = replaceFileImageSources(
      content,
      new Map([['file-1', 'https://signed.example/current']]),
    );

    expect(resolved.content?.[0]).toMatchObject({
      attrs: {
        src: 'https://signed.example/current',
        fileId: 'file-1',
      },
    });
    expect(content.content?.[0]).toMatchObject({
      attrs: { src: 'https://expired.example/old' },
    });
  });
});
