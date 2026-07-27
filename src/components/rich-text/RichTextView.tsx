import { useEffect } from 'react';
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import Youtube from '@tiptap/extension-youtube';
import type { RichTextContent } from '@/types';
import { cn } from '@/lib/cn';
import { VideoEmbed } from './videoEmbed';
import { FileImage } from './fileImages';
import { useResolvedFileImages } from './useResolvedFileImages';

const extensions = [
  StarterKit.configure({ link: { openOnClick: true } }),
  FileImage.configure({ allowBase64: false }),
  Youtube.configure({ controls: true, nocookie: true }),
  VideoEmbed,
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
];

export function RichTextView({
  content,
  className,
}: {
  content?: RichTextContent;
  className?: string;
}) {
  const resolvedContent = useResolvedFileImages(content);
  const editor = useEditor({
    extensions,
    content: resolvedContent as JSONContent | undefined,
    editable: false,
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && resolvedContent) editor.commands.setContent(resolvedContent as JSONContent);
  }, [editor, resolvedContent]);

  return <EditorContent editor={editor} className={cn('rich-text', className)} />;
}
