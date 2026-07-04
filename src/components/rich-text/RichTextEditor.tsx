import { useEffect, type ReactNode } from 'react';
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import Youtube from '@tiptap/extension-youtube';
import {
  Bold,
  Code2,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  LinkIcon,
  List,
  ListOrdered,
  Pilcrow,
  TableIcon,
  Video,
} from 'lucide-react';
import type { RichTextContent } from '@/types';
import { cn } from '@/lib/cn';

const extensions = [
  StarterKit,
  Link.configure({ openOnClick: false }),
  Image.configure({ allowBase64: true }),
  Youtube.configure({ controls: true, nocookie: true }),
  Placeholder.configure({ placeholder: 'Начните писать...' }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
];

function ToolButton({
  active,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800',
        active && 'bg-primary-50 text-primary-700',
      )}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  value,
  onChange,
  minHeight = 260,
}: {
  value: RichTextContent;
  onChange: (value: RichTextContent) => void;
  minHeight?: number;
}) {
  const editor = useEditor({
    extensions,
    content: value as JSONContent,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getJSON() as RichTextContent),
    editorProps: {
      attributes: {
        class: 'rich-text rich-text-editor focus:outline-none',
        style: `min-height: ${minHeight}px`,
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(editor.getJSON());
    const next = JSON.stringify(value);
    if (current !== next) editor.commands.setContent(value as JSONContent);
  }, [editor, value]);

  if (!editor) return null;

  const addLink = () => {
    const href = window.prompt('URL');
    if (!href) return;
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  };

  const addImage = () => {
    const src = window.prompt('URL изображения');
    if (!src) return;
    editor.chain().focus().setImage({ src }).run();
  };

  const addVideo = () => {
    const src = window.prompt('YouTube URL');
    if (!src) return;
    editor.chain().focus().setYoutubeVideo({ src, width: 640, height: 360 }).run();
  };

  return (
    <div className="overflow-hidden rounded-md border border-slate-300 bg-surface">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-2">
        <ToolButton label="Абзац" onClick={() => editor.chain().focus().setParagraph().run()}>
          <Pilcrow className="size-4" />
        </ToolButton>
        <ToolButton
          label="Заголовок 2"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="size-4" />
        </ToolButton>
        <ToolButton
          label="Заголовок 3"
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="size-4" />
        </ToolButton>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <ToolButton
          label="Жирный"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="size-4" />
        </ToolButton>
        <ToolButton
          label="Курсив"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-4" />
        </ToolButton>
        <ToolButton
          label="Код"
          active={editor.isActive('codeBlock')}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <Code2 className="size-4" />
        </ToolButton>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <ToolButton
          label="Маркированный список"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="size-4" />
        </ToolButton>
        <ToolButton
          label="Нумерованный список"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="size-4" />
        </ToolButton>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <ToolButton label="Ссылка" active={editor.isActive('link')} onClick={addLink}>
          <LinkIcon className="size-4" />
        </ToolButton>
        <ToolButton label="Изображение" onClick={addImage}>
          <ImageIcon className="size-4" />
        </ToolButton>
        <ToolButton label="Видео" onClick={addVideo}>
          <Video className="size-4" />
        </ToolButton>
        <ToolButton
          label="Таблица"
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
        >
          <TableIcon className="size-4" />
        </ToolButton>
      </div>
      <EditorContent editor={editor} className="px-4 py-3" />
    </div>
  );
}
