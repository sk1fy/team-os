import { useEffect, useState, type ReactNode } from 'react';
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
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
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { normalizeVideoUrl, VideoEmbed } from './videoEmbed';

const extensions = [
  StarterKit.configure({ link: { openOnClick: false } }),
  Image.configure({ allowBase64: true }),
  Youtube.configure({ controls: true, nocookie: true }),
  VideoEmbed,
  Placeholder.configure({ placeholder: 'Начните писать...' }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
];

function isValidWebUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

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
  label = 'Редактор форматированного текста',
}: {
  value: RichTextContent;
  onChange: (value: RichTextContent) => void;
  minHeight?: number;
  label?: string;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState<string>();
  const [imageOpen, setImageOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [imageError, setImageError] = useState<string>();
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [videoError, setVideoError] = useState<string>();
  const editor = useEditor({
    extensions,
    content: value as JSONContent,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getJSON() as RichTextContent),
    editorProps: {
      attributes: {
        class: 'rich-text rich-text-editor focus:outline-none',
        style: `min-height: ${minHeight}px`,
        role: 'textbox',
        'aria-label': label,
        'aria-multiline': 'true',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(editor.getJSON());
    const next = JSON.stringify(value);
    if (current !== next) {
      editor.commands.setContent(value as JSONContent, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) return null;

  const addLink = () => {
    const href = linkUrl.trim();
    if (!isValidWebUrl(href)) {
      setLinkError('Введите корректную ссылку, начинающуюся с http:// или https://.');
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    setLinkOpen(false);
    setLinkUrl('');
    setLinkError(undefined);
  };

  const addImage = () => {
    const src = imageUrl.trim();
    if (!isValidWebUrl(src)) {
      setImageError('Введите корректную ссылку на изображение с http:// или https://.');
      return;
    }
    editor
      .chain()
      .focus()
      .setImage({ src, alt: imageAlt.trim() || undefined })
      .run();
    setImageOpen(false);
    setImageUrl('');
    setImageAlt('');
    setImageError(undefined);
  };

  const addVideo = () => {
    const source = normalizeVideoUrl(videoUrl);
    if (!source) {
      setVideoError(
        'Поддерживаются HTTPS-ссылки на MP4/WebM, YouTube, Vimeo, Rutube, Loom и Kinescope.',
      );
      return;
    }
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'videoEmbed',
        attrs: { ...source, title: videoTitle.trim() || 'Видео' },
      })
      .run();
    setVideoOpen(false);
    setVideoUrl('');
    setVideoTitle('');
    setVideoError(undefined);
  };

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-surface">
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
        <ToolButton
          label="Ссылка"
          active={editor.isActive('link')}
          onClick={() => {
            setLinkUrl(String(editor.getAttributes('link').href ?? ''));
            setLinkError(undefined);
            setLinkOpen(true);
          }}
        >
          <LinkIcon className="size-4" />
        </ToolButton>
        <ToolButton
          label="Изображение"
          onClick={() => {
            setImageUrl('');
            setImageAlt('');
            setImageError(undefined);
            setImageOpen(true);
          }}
        >
          <ImageIcon className="size-4" />
        </ToolButton>
        <ToolButton
          label="Видео"
          onClick={() => {
            setVideoError(undefined);
            setVideoOpen(true);
          }}
        >
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
      <Modal
        open={linkOpen}
        onOpenChange={setLinkOpen}
        title="Добавить ссылку"
        description="Укажите полный адрес страницы, начинающийся с http:// или https://."
        footer={
          <>
            <Button variant="secondary" onClick={() => setLinkOpen(false)}>
              Отмена
            </Button>
            <Button disabled={!linkUrl.trim()} onClick={addLink}>
              Добавить
            </Button>
          </>
        }
      >
        <Input
          label="Ссылка"
          value={linkUrl}
          onChange={(event) => {
            setLinkUrl(event.target.value);
            setLinkError(undefined);
          }}
          placeholder="https://example.com"
          error={linkError}
          autoFocus
        />
      </Modal>
      <Modal
        open={imageOpen}
        onOpenChange={setImageOpen}
        title="Добавить изображение"
        description="Вставьте прямую ссылку на изображение и при необходимости добавьте описание."
        footer={
          <>
            <Button variant="secondary" onClick={() => setImageOpen(false)}>
              Отмена
            </Button>
            <Button disabled={!imageUrl.trim()} onClick={addImage}>
              Добавить
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Ссылка на изображение"
            value={imageUrl}
            onChange={(event) => {
              setImageUrl(event.target.value);
              setImageError(undefined);
            }}
            placeholder="https://example.com/image.jpg"
            error={imageError}
            autoFocus
          />
          <Input
            label="Описание для доступности"
            value={imageAlt}
            onChange={(event) => setImageAlt(event.target.value)}
            placeholder="Например: схема рабочего процесса"
          />
        </div>
      </Modal>
      <Modal
        open={videoOpen}
        onOpenChange={setVideoOpen}
        title="Добавить видео"
        description="Вставьте прямую ссылку на MP4/WebM или ссылку из поддерживаемого видеосервиса."
        footer={
          <>
            <Button variant="secondary" onClick={() => setVideoOpen(false)}>
              Отмена
            </Button>
            <Button disabled={!videoUrl.trim()} onClick={addVideo}>
              Добавить
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Ссылка на видео"
            value={videoUrl}
            onChange={(event) => {
              setVideoUrl(event.target.value);
              setVideoError(undefined);
            }}
            placeholder="https://..."
            error={videoError}
          />
          <Input
            label="Название для доступности"
            value={videoTitle}
            onChange={(event) => setVideoTitle(event.target.value)}
            placeholder="Например: Демонстрация работы"
          />
        </div>
      </Modal>
    </div>
  );
}
