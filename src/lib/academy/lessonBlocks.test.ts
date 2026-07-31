import { describe, expect, it } from 'vitest';
import type { RichTextContent } from '@/types';
import type { LessonBlock } from './lessonBlocks';
import {
  createLessonBlock,
  lessonBlocksHaveMeaningfulContent,
  parseLessonBlocks,
  serializeLessonBlocks,
} from './lessonBlocks';

describe('lesson blocks storage', () => {
  it('wraps legacy TipTap content and appends a quiz marker when the lesson has a quiz', () => {
    const legacyContent: RichTextContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Legacy lesson' }],
        },
      ],
    };

    expect(parseLessonBlocks(legacyContent, true)).toEqual([
      { id: 'primary-content', kind: 'richText', content: legacyContent },
      { id: 'lesson-quiz', kind: 'quiz' },
    ]);
  });

  it('round-trips special blocks in order and keeps the quiz marker only for quiz lessons', () => {
    const blocks: LessonBlock[] = [
      {
        id: 'intro',
        kind: 'richText',
        content: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Intro' }] }],
        },
      },
      {
        id: 'warning',
        kind: 'callout',
        style: 'accent',
        tone: 'warning',
        title: 'Do not skip',
        body: 'Read this first.',
      },
      {
        id: 'pitfalls',
        kind: 'comparison',
        style: 'outline',
        eyebrow: 'Common pitfalls',
        rows: [{ id: 'row-1', avoid: 'Guess', prefer: 'Verify' }],
      },
      {
        id: 'check',
        kind: 'checklist',
        style: 'minimal',
        title: 'Before continuing',
        items: [{ id: 'item-1', text: 'Save your work' }],
      },
      {
        id: 'steps',
        kind: 'steps',
        style: 'card',
        title: 'How to proceed',
        items: [{ id: 'step-1', text: 'Review the evidence' }],
      },
      {
        id: 'practice',
        kind: 'practice',
        style: 'accent',
        title: 'Try it',
        description: 'Apply the lesson.',
        action: 'Write down the result.',
      },
      { id: 'quiz-marker', kind: 'quiz' },
      {
        id: 'summary',
        kind: 'takeaway',
        style: 'outline',
        title: 'Remember',
        body: 'Verification matters.',
      },
    ];
    const stored = serializeLessonBlocks(blocks);

    expect(parseLessonBlocks(stored, true)).toEqual(blocks);
    expect(parseLessonBlocks(stored, false).map((block) => block.id)).toEqual([
      'intro',
      'warning',
      'pitfalls',
      'check',
      'steps',
      'practice',
      'summary',
    ]);
  });

  it('adds the mandatory rich-text block before stored special blocks', () => {
    const stored: RichTextContent = {
      type: 'doc',
      content: [
        {
          type: 'lessonBlock',
          attrs: {
            id: 'practice-1',
            kind: 'practice',
            data: {
              title: 'Try it',
              description: 'Apply the lesson.',
              action: 'Write down the result.',
            },
          },
        },
      ],
    };

    expect(parseLessonBlocks(stored)).toEqual([
      {
        id: 'primary-content',
        kind: 'richText',
        content: { type: 'doc', content: [{ type: 'paragraph' }] },
      },
      {
        id: 'practice-1',
        kind: 'practice',
        style: 'card',
        title: 'Try it',
        description: 'Apply the lesson.',
        action: 'Write down the result.',
      },
    ]);
  });

  it('defaults old special blocks to the card style', () => {
    const stored: RichTextContent = {
      type: 'doc',
      content: [
        {
          type: 'lessonBlock',
          attrs: {
            id: 'takeaway-legacy',
            kind: 'takeaway',
            data: { title: 'Remember', body: 'This has no stored style.' },
          },
        },
      ],
    };

    expect(parseLessonBlocks(stored)).toContainEqual({
      id: 'takeaway-legacy',
      kind: 'takeaway',
      style: 'card',
      title: 'Remember',
      body: 'This has no stored style.',
    });
  });

  it('creates each special block with the default card style', () => {
    const specialKinds = [
      'callout',
      'comparison',
      'takeaway',
      'steps',
      'checklist',
      'practice',
    ] as const;

    for (const kind of specialKinds) {
      expect(createLessonBlock(kind)).toMatchObject({ kind, style: 'card' });
    }
  });

  it('preserves legacy nodes mixed with block nodes', () => {
    const stored: RichTextContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Before' }] },
        {
          type: 'lessonBlock',
          attrs: { id: 'takeaway-1', kind: 'takeaway', data: { title: 'Remember', body: 'This' } },
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'After' }] },
      ],
    };

    const blocks = parseLessonBlocks(stored);

    expect(blocks.map((block) => block.kind)).toEqual(['richText', 'takeaway', 'richText']);
    expect(blocks[0]).toMatchObject({ id: 'legacy-content-1' });
    expect(blocks[2]).toMatchObject({ id: 'legacy-content-3' });
  });

  it('does not treat an empty editor node as lesson content', () => {
    expect(
      lessonBlocksHaveMeaningfulContent([
        {
          id: 'empty',
          kind: 'richText',
          content: { type: 'doc', content: [{ type: 'paragraph' }] },
        },
      ]),
    ).toBe(false);
  });
});
