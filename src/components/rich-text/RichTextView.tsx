import { useEffect } from 'react';
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import Youtube from '@tiptap/extension-youtube';
import type { RichTextContent } from '@/types';
import { cn } from '@/lib/cn';
import { VideoEmbed } from './videoEmbed';

const extensions = [
  StarterKit.configure({ link: { openOnClick: true } }),
  Image.configure({ allowBase64: true }),
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
  const editor = useEditor({
    extensions,
    content: content as JSONContent | undefined,
    editable: false,
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && content) editor.commands.setContent(content as JSONContent);
  }, [content, editor]);

  return <EditorContent editor={editor} className={cn('rich-text', className)} />;
}
