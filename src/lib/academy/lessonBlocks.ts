import { createId } from '@/lib/id';
import type { RichTextContent } from '@/types';

export type LessonBlockKind =
  'richText' | 'callout' | 'comparison' | 'takeaway' | 'steps' | 'checklist' | 'practice' | 'quiz';

export type LessonBlockStyle = 'card' | 'accent' | 'minimal' | 'outline';

export interface LessonTextBlock {
  id: string;
  kind: 'richText';
  content: RichTextContent;
}

export interface LessonCalloutBlock {
  id: string;
  kind: 'callout';
  style: LessonBlockStyle;
  tone: 'info' | 'warning' | 'success';
  title: string;
  body: string;
}

export interface LessonComparisonBlock {
  id: string;
  kind: 'comparison';
  style: LessonBlockStyle;
  eyebrow: string;
  rows: Array<{ id: string; avoid: string; prefer: string }>;
}

export interface LessonTakeawayBlock {
  id: string;
  kind: 'takeaway';
  style: LessonBlockStyle;
  title: string;
  body: string;
}

export interface LessonStepsBlock {
  id: string;
  kind: 'steps';
  style: LessonBlockStyle;
  title: string;
  items: Array<{ id: string; text: string }>;
}

export interface LessonChecklistBlock {
  id: string;
  kind: 'checklist';
  style: LessonBlockStyle;
  title: string;
  items: Array<{ id: string; text: string }>;
}

export interface LessonPracticeBlock {
  id: string;
  kind: 'practice';
  style: LessonBlockStyle;
  title: string;
  description: string;
  action: string;
}

export interface LessonQuizBlock {
  id: string;
  kind: 'quiz';
}

export type LessonBlock =
  | LessonTextBlock
  | LessonCalloutBlock
  | LessonComparisonBlock
  | LessonTakeawayBlock
  | LessonStepsBlock
  | LessonChecklistBlock
  | LessonPracticeBlock
  | LessonQuizBlock;

type StoredLessonBlockNode = {
  type: 'lessonBlock';
  attrs?: {
    id?: unknown;
    kind?: unknown;
    data?: unknown;
  };
  content?: unknown[];
};

const emptyRichText = (): RichTextContent => ({ type: 'doc', content: [{ type: 'paragraph' }] });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const stringValue = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;

const blockStyle = (value: unknown): LessonBlockStyle =>
  value === 'accent' || value === 'minimal' || value === 'outline' || value === 'card'
    ? value
    : 'card';

const storedItems = (value: unknown): Array<{ id: string; text: string }> =>
  Array.isArray(value)
    ? value.flatMap((item, index) =>
        isRecord(item) && typeof item.text === 'string'
          ? [{ id: stringValue(item.id, `item-${index}`), text: item.text }]
          : [],
      )
    : [];

function parseStoredBlock(node: StoredLessonBlockNode, index: number): LessonBlock | null {
  const id = stringValue(node.attrs?.id, `block-${index}`);
  const kind = node.attrs?.kind;
  const data = isRecord(node.attrs?.data) ? node.attrs.data : {};

  switch (kind) {
    case 'richText':
      return { id, kind, content: { type: 'doc', content: node.content ?? [] } };
    case 'callout':
      return {
        id,
        kind,
        style: blockStyle(data.style),
        tone:
          data.tone === 'warning' || data.tone === 'success' || data.tone === 'info'
            ? data.tone
            : 'warning',
        title: stringValue(data.title),
        body: stringValue(data.body),
      };
    case 'comparison':
      return {
        id,
        kind,
        style: blockStyle(data.style),
        eyebrow: stringValue(data.eyebrow, 'Частые ошибки'),
        rows: Array.isArray(data.rows)
          ? data.rows.flatMap((row, rowIndex) =>
              isRecord(row)
                ? [
                    {
                      id: stringValue(row.id, `row-${rowIndex}`),
                      avoid: stringValue(row.avoid),
                      prefer: stringValue(row.prefer),
                    },
                  ]
                : [],
            )
          : [],
      };
    case 'takeaway':
      return {
        id,
        kind,
        style: blockStyle(data.style),
        title: stringValue(data.title, 'Главная мысль'),
        body: stringValue(data.body),
      };
    case 'steps':
      return {
        id,
        kind,
        style: blockStyle(data.style),
        title: stringValue(data.title, 'Пошаговый алгоритм'),
        items: storedItems(data.items),
      };
    case 'checklist':
      return {
        id,
        kind,
        style: blockStyle(data.style),
        title: stringValue(data.title, 'Проверьте себя'),
        items: storedItems(data.items),
      };
    case 'practice':
      return {
        id,
        kind,
        style: blockStyle(data.style),
        title: stringValue(data.title, 'Примените на практике'),
        description: stringValue(data.description),
        action: stringValue(data.action),
      };
    case 'quiz':
      return { id, kind };
    default:
      return null;
  }
}

export function parseLessonBlocks(
  content: RichTextContent | undefined,
  hasQuiz = false,
): LessonBlock[] {
  const nodes = content?.content ?? [];
  const hasStoredBlocks = nodes.some((node) => isRecord(node) && node.type === 'lessonBlock');

  if (!hasStoredBlocks) {
    const blocks: LessonBlock[] = [
      {
        id: 'primary-content',
        kind: 'richText',
        content: content ?? emptyRichText(),
      },
    ];
    if (hasQuiz) blocks.push({ id: 'lesson-quiz', kind: 'quiz' });
    return blocks;
  }

  const blocks: LessonBlock[] = [];
  let legacyNodes: unknown[] = [];
  const flushLegacyNodes = (index: number) => {
    if (legacyNodes.length === 0) return;
    blocks.push({
      id: `legacy-content-${index}`,
      kind: 'richText',
      content: { type: 'doc', content: legacyNodes },
    });
    legacyNodes = [];
  };

  nodes.forEach((node, index) => {
    if (!isRecord(node) || node.type !== 'lessonBlock') {
      legacyNodes.push(node);
      return;
    }
    flushLegacyNodes(index);
    const parsed = parseStoredBlock(node as StoredLessonBlockNode, index);
    if (parsed) blocks.push(parsed);
  });
  flushLegacyNodes(nodes.length);

  if (!blocks.some((block) => block.kind === 'richText')) {
    blocks.unshift({ id: 'primary-content', kind: 'richText', content: emptyRichText() });
  }
  if (hasQuiz && !blocks.some((block) => block.kind === 'quiz')) {
    blocks.push({ id: 'lesson-quiz', kind: 'quiz' });
  }
  let quizIncluded = false;
  return blocks.filter((block) => {
    if (block.kind !== 'quiz') return true;
    if (!hasQuiz || quizIncluded) return false;
    quizIncluded = true;
    return true;
  });
}

function blockData(block: Exclude<LessonBlock, LessonTextBlock | LessonQuizBlock>) {
  switch (block.kind) {
    case 'callout':
      return { style: block.style, tone: block.tone, title: block.title, body: block.body };
    case 'comparison':
      return { style: block.style, eyebrow: block.eyebrow, rows: block.rows };
    case 'takeaway':
      return { style: block.style, title: block.title, body: block.body };
    case 'steps':
    case 'checklist':
      return { style: block.style, title: block.title, items: block.items };
    case 'practice':
      return {
        style: block.style,
        title: block.title,
        description: block.description,
        action: block.action,
      };
  }
}

export function serializeLessonBlocks(blocks: LessonBlock[]): RichTextContent {
  return {
    type: 'doc',
    content: blocks.map((block) => ({
      type: 'lessonBlock',
      attrs: {
        id: block.id,
        kind: block.kind,
        ...(block.kind === 'richText' || block.kind === 'quiz' ? {} : { data: blockData(block) }),
      },
      ...(block.kind === 'richText' ? { content: block.content.content ?? [] } : {}),
    })),
  };
}

export function createLessonBlock(kind: LessonBlockKind): LessonBlock {
  const id = createId();
  switch (kind) {
    case 'richText':
      return { id, kind, content: emptyRichText() };
    case 'callout':
      return {
        id,
        kind,
        style: 'card',
        tone: 'warning',
        title: 'Обратите внимание',
        body: 'Коротко объясните риск или важное ограничение.',
      };
    case 'comparison':
      return {
        id,
        kind,
        style: 'card',
        eyebrow: 'Частые ошибки',
        rows: [
          {
            id: createId(),
            avoid: 'Опишите нежелательный подход',
            prefer: 'Покажите правильную альтернативу',
          },
        ],
      };
    case 'takeaway':
      return {
        id,
        kind,
        style: 'card',
        title: 'Главная мысль',
        body: 'Сформулируйте идею, которую важно унести из урока.',
      };
    case 'steps':
      return {
        id,
        kind,
        style: 'card',
        title: 'Пошаговый алгоритм',
        items: [
          { id: createId(), text: 'Первый шаг' },
          { id: createId(), text: 'Второй шаг' },
        ],
      };
    case 'checklist':
      return {
        id,
        kind,
        style: 'card',
        title: 'Проверьте себя',
        items: [
          { id: createId(), text: 'Первый критерий' },
          { id: createId(), text: 'Второй критерий' },
        ],
      };
    case 'practice':
      return {
        id,
        kind,
        style: 'card',
        title: 'Примените на практике',
        description: 'Свяжите материал урока с реальной рабочей ситуацией.',
        action: 'Выполните действие и зафиксируйте результат.',
      };
    case 'quiz':
      return { id, kind };
  }
}

export function lessonBlocksHaveMeaningfulContent(blocks: LessonBlock[]): boolean {
  const richTextHasContent = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(richTextHasContent);
    if (!isRecord(value)) return false;
    if (typeof value.text === 'string' && value.text.trim()) return true;
    if (
      value.type === 'image' ||
      value.type === 'video' ||
      value.type === 'youtube' ||
      value.type === 'videoEmbed' ||
      value.type === 'table' ||
      value.type === 'codeBlock' ||
      value.type === 'horizontalRule'
    ) {
      return true;
    }
    return richTextHasContent(value.content);
  };

  return blocks.some((block) => {
    if (block.kind === 'quiz') return false;
    if (block.kind === 'richText') return richTextHasContent(block.content.content);
    if (block.kind === 'comparison') {
      return block.rows.some((row) => row.avoid.trim() || row.prefer.trim());
    }
    if (block.kind === 'steps' || block.kind === 'checklist') {
      return Boolean(block.title.trim() || block.items.some((item) => item.text.trim()));
    }
    if (block.kind === 'practice') {
      return Boolean(block.title.trim() || block.description.trim() || block.action.trim());
    }
    return Boolean(block.title.trim() || block.body.trim());
  });
}
