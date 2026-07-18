import type { RichTextContent } from '@/types';

type RichTextNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: RichTextNode[];
};

export function richTextToPlainText(content?: RichTextContent): string {
  if (!content?.content) return '';

  const collect = (nodes: RichTextNode[]): string =>
    nodes
      .map((node) => {
        if (node.text) return node.text;
        if (node.content) return collect(node.content);
        return '';
      })
      .filter(Boolean)
      .join(' ');

  return collect(content.content as RichTextNode[]);
}

export function plainTextToRichText(text: string): RichTextContent {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return {
    type: 'doc',
    content:
      paragraphs.length > 0
        ? paragraphs.map((paragraph) => ({
            type: 'paragraph',
            content: [{ type: 'text', text: paragraph }],
          }))
        : [{ type: 'paragraph' }],
  };
}

export function richTextToEditableText(content?: RichTextContent): string {
  if (!content?.content) return '';

  const blockText = (node: RichTextNode): string => {
    const text = node.content ? richTextToPlainText({ type: 'doc', content: node.content }) : '';
    if (node.type === 'heading') return `${'#'.repeat(Number(node.attrs?.level ?? 2))} ${text}`;
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      return (node.content ?? []).map((item) => `- ${blockText(item)}`).join('\n');
    }
    return text;
  };

  return (content.content as RichTextNode[]).map(blockText).filter(Boolean).join('\n\n');
}

export function getRichTextHeadings(content?: RichTextContent) {
  const headings: Array<{ id: string; text: string; level: number }> = [];
  const visit = (nodes: RichTextNode[]) => {
    for (const node of nodes) {
      if (node.type === 'heading') {
        const text = node.content
          ? richTextToPlainText({ type: 'doc', content: node.content })
          : '';
        if (text) {
          headings.push({
            id: text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-'),
            text,
            level: Number(node.attrs?.level ?? 2),
          });
        }
      }
      if (node.content) visit(node.content);
    }
  };

  visit((content?.content ?? []) as RichTextNode[]);
  return headings;
}
