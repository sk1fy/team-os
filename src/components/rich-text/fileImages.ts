import Image from '@tiptap/extension-image';
import type { RichTextContent } from '@/types';

export const FileImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fileId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-file-id'),
        renderHTML: (attributes) =>
          typeof attributes.fileId === 'string' && attributes.fileId
            ? { 'data-file-id': attributes.fileId }
            : {},
      },
    };
  },
});

function visitNodes(value: unknown, visitor: (node: Record<string, unknown>) => void): void {
  if (!value || typeof value !== 'object') return;
  const node = value as Record<string, unknown>;
  visitor(node);
  if (Array.isArray(node.content)) {
    node.content.forEach((child) => visitNodes(child, visitor));
  }
}

export function richTextFileIds(content: RichTextContent): string[] {
  const ids = new Set<string>();
  visitNodes(content, (node) => {
    if (!node.attrs || typeof node.attrs !== 'object') return;
    const fileId = (node.attrs as Record<string, unknown>).fileId;
    if (typeof fileId === 'string' && fileId) ids.add(fileId);
  });
  return [...ids];
}

export function replaceFileImageSources(
  content: RichTextContent,
  urlsByFileId: ReadonlyMap<string, string>,
): RichTextContent {
  if (urlsByFileId.size === 0) return content;
  const copy = structuredClone(content);
  visitNodes(copy, (node) => {
    if (!node.attrs || typeof node.attrs !== 'object') return;
    const attrs = node.attrs as Record<string, unknown>;
    const fileId = typeof attrs.fileId === 'string' ? attrs.fileId : undefined;
    const currentUrl = fileId ? urlsByFileId.get(fileId) : undefined;
    if (currentUrl) attrs.src = currentUrl;
  });
  return copy;
}
