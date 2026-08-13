import { useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpenText,
  Check,
  ClipboardCheck,
  Lightbulb,
  ListChecks,
  Palette,
  Plus,
  Route,
  Scale,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  Button,
  Dropdown,
  type DropdownItem,
  Input,
  Modal,
  RichTextEditor,
  Select,
  Textarea,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { createId } from '@/lib/id';
import {
  createLessonBlock,
  type LessonBlock,
  type LessonBlockKind,
  type LessonBlockStyle,
  type LessonChecklistBlock,
  type LessonStepsBlock,
} from '@/lib/academy/lessonBlocks';
import type { QuizAuthor } from '@/types/academy';
import { QuizEditor, createEmptyQuiz } from './QuizEditor';

const blockMeta: Record<
  LessonBlockKind,
  { label: string; description: string; icon: typeof BookOpenText; tone: string }
> = {
  richText: {
    label: 'Редактор материала',
    description: 'Текст, изображения, видео и таблицы',
    icon: BookOpenText,
    tone: 'bg-slate-100 text-slate-700',
  },
  quiz: {
    label: 'Тест',
    description: 'Проверка знаний с проходным баллом',
    icon: ListChecks,
    tone: 'bg-violet-50 text-violet-700',
  },
  callout: {
    label: 'Важное замечание',
    description: 'Риск, ограничение или совет',
    icon: AlertTriangle,
    tone: 'bg-amber-50 text-amber-700',
  },
  comparison: {
    label: 'Избегать / предпочитать',
    description: 'Сравнение ошибки и правильного подхода',
    icon: Scale,
    tone: 'bg-rose-50 text-rose-700',
  },
  takeaway: {
    label: 'Ключевой вывод',
    description: 'Главная мысль смыслового блока',
    icon: Lightbulb,
    tone: 'bg-sky-50 text-sky-700',
  },
  steps: {
    label: 'Пошаговый алгоритм',
    description: 'Последовательность действий',
    icon: Route,
    tone: 'bg-indigo-50 text-indigo-700',
  },
  checklist: {
    label: 'Чек-лист',
    description: 'Критерии самопроверки',
    icon: ClipboardCheck,
    tone: 'bg-emerald-50 text-emerald-700',
  },
  practice: {
    label: 'Практическое задание',
    description: 'Перенос материала в рабочую задачу',
    icon: Sparkles,
    tone: 'bg-primary-50 text-primary-700',
  },
};

const blockStyleOptions: Array<{ value: LessonBlockStyle; label: string }> = [
  { value: 'card', label: 'Карточка — мягкий фон' },
  { value: 'accent', label: 'Акцент — цветная заливка' },
  { value: 'minimal', label: 'Минимал — без контейнера' },
  { value: 'outline', label: 'Контур — только рамка' },
];

type StyledLessonBlock = Exclude<LessonBlock, { kind: 'richText' } | { kind: 'quiz' }>;

function isStyledBlock(block: LessonBlock): block is StyledLessonBlock {
  return block.kind !== 'richText' && block.kind !== 'quiz';
}

export function LessonBlocksEditor({
  lessonId,
  blocks,
  quiz,
  disabled,
  onChange,
}: {
  lessonId: string;
  blocks: LessonBlock[];
  quiz: QuizAuthor | null;
  disabled?: boolean;
  onChange: (blocks: LessonBlock[], quiz: QuizAuthor | null) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const textBlockCount = blocks.filter((block) => block.kind === 'richText').length;

  const updateBlock = (id: string, updater: (block: LessonBlock) => LessonBlock) =>
    onChange(
      blocks.map((block) => (block.id === id ? updater(block) : block)),
      quiz,
    );

  const moveBlock = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = blocks.slice();
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    onChange(next, quiz);
  };

  const removeBlock = (block: LessonBlock) => {
    if (block.kind === 'richText' && textBlockCount === 1) return;
    const nextBlocks = blocks.filter((item) => item.id !== block.id);
    onChange(nextBlocks, block.kind === 'quiz' ? null : quiz);
  };

  const addBlock = (kind: LessonBlockKind) => {
    if (kind === 'quiz' && quiz) return;
    const nextBlock = createLessonBlock(kind);
    onChange([...blocks, nextBlock], kind === 'quiz' ? createEmptyQuiz(lessonId) : quiz);
    setAddOpen(false);
  };

  return (
    <div className="space-y-4">
      <ol className="space-y-4">
        {blocks.map((block, index) => {
          const meta = blockMeta[block.kind];
          const Icon = meta.icon;
          const canRemove = block.kind !== 'richText' || textBlockCount > 1;
          const styleItems: DropdownItem[] = isStyledBlock(block)
            ? blockStyleOptions.map((option) => ({
                key: option.value,
                label: option.label,
                icon: option.value === block.style ? Check : undefined,
                onSelect: () =>
                  updateBlock(block.id, (current) =>
                    isStyledBlock(current) ? { ...current, style: option.value } : current,
                  ),
              }))
            : [];
          const currentStyleLabel = isStyledBlock(block)
            ? blockStyleOptions.find((option) => option.value === block.style)?.label
            : undefined;
          return (
            <li
              key={block.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-card"
            >
              <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-3 py-2.5 dark:bg-slate-800/70">
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-lg',
                    meta.tone,
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-800">{meta.label}</p>
                  <p className="truncate text-[11px] text-slate-500">{meta.description}</p>
                </div>
                <div className="flex items-center gap-0.5">
                  {isStyledBlock(block) ? (
                    <Dropdown
                      align="end"
                      className="min-w-64"
                      items={styleItems}
                      trigger={
                        <button
                          type="button"
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-30"
                          disabled={disabled}
                          aria-label={`Выбрать внешний вид блока «${meta.label}»`}
                          title={`Внешний вид: ${currentStyleLabel ?? 'Карточка'}`}
                        >
                          <Palette className="size-4" />
                        </button>
                      }
                    />
                  ) : null}
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-30"
                    disabled={disabled || index === 0}
                    onClick={() => moveBlock(index, -1)}
                    aria-label={`Переместить блок «${meta.label}» выше`}
                  >
                    <ArrowUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-30"
                    disabled={disabled || index === blocks.length - 1}
                    onClick={() => moveBlock(index, 1)}
                    aria-label={`Переместить блок «${meta.label}» ниже`}
                  >
                    <ArrowDown className="size-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                    disabled={disabled || !canRemove}
                    onClick={() => removeBlock(block)}
                    aria-label={`Удалить блок «${meta.label}»`}
                    title={
                      canRemove ? 'Удалить блок' : 'В уроке должен остаться хотя бы один редактор'
                    }
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <div className="p-4">
                <BlockEditor
                  block={block}
                  quiz={quiz}
                  disabled={disabled}
                  onUpdate={(next) => updateBlock(block.id, () => next)}
                  onQuizChange={(next) => onChange(blocks, next)}
                />
              </div>
            </li>
          );
        })}
      </ol>

      <Button
        variant="secondary"
        className="w-full border-dashed"
        disabled={disabled}
        onClick={() => setAddOpen(true)}
      >
        <Plus className="size-4" />
        Добавить блок
      </Button>

      <Modal
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Добавить блок в урок"
        description="Соберите урок из небольших смысловых и интерактивных частей."
        size="lg"
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(blockMeta) as LessonBlockKind[]).map((kind) => {
            const meta = blockMeta[kind];
            const Icon = meta.icon;
            const unavailable = disabled || (kind === 'quiz' && Boolean(quiz));
            return (
              <button
                key={kind}
                type="button"
                disabled={unavailable}
                onClick={() => addBlock(kind)}
                className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-primary-200 hover:bg-primary-50/40 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-lg',
                    meta.tone,
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{meta.label}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                    {kind === 'quiz' && quiz ? 'В уроке уже есть тест' : meta.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}

function BlockEditor({
  block,
  quiz,
  disabled,
  onUpdate,
  onQuizChange,
}: {
  block: LessonBlock;
  quiz: QuizAuthor | null;
  disabled?: boolean;
  onUpdate: (block: LessonBlock) => void;
  onQuizChange: (quiz: QuizAuthor | null) => void;
}) {
  switch (block.kind) {
    case 'richText':
      return (
        <RichTextEditor
          value={block.content}
          minHeight={220}
          label="Редактор блока материала"
          onChange={(content) => onUpdate({ ...block, content })}
        />
      );
    case 'quiz':
      return quiz ? (
        <QuizEditor quiz={quiz} disabled={disabled} onChange={onQuizChange} />
      ) : (
        <p className="text-sm text-slate-500">Тест удалён. Добавьте блок заново.</p>
      );
    case 'callout':
      return (
        <div className="space-y-3">
          <Select
            label="Тип сообщения"
            value={block.tone}
            disabled={disabled}
            onValueChange={(tone) => onUpdate({ ...block, tone: tone as typeof block.tone })}
            options={[
              { value: 'warning', label: 'Предупреждение' },
              { value: 'info', label: 'Полезно знать' },
              { value: 'success', label: 'Хорошая практика' },
            ]}
          />
          <Input
            label="Заголовок"
            value={block.title}
            disabled={disabled}
            onChange={(event) => onUpdate({ ...block, title: event.target.value })}
          />
          <Textarea
            label="Текст"
            rows={3}
            value={block.body}
            disabled={disabled}
            onChange={(event) => onUpdate({ ...block, body: event.target.value })}
          />
        </div>
      );
    case 'comparison':
      return (
        <div className="space-y-3">
          <Input
            label="Надпись над блоком"
            value={block.eyebrow}
            disabled={disabled}
            onChange={(event) => onUpdate({ ...block, eyebrow: event.target.value })}
          />
          {block.rows.map((row, index) => (
            <div
              key={row.id}
              className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_auto]"
            >
              <Textarea
                label={`Избегать · ${index + 1}`}
                rows={3}
                value={row.avoid}
                disabled={disabled}
                onChange={(event) =>
                  onUpdate({
                    ...block,
                    rows: block.rows.map((item) =>
                      item.id === row.id ? { ...item, avoid: event.target.value } : item,
                    ),
                  })
                }
              />
              <Textarea
                label={`Предпочитать · ${index + 1}`}
                rows={3}
                value={row.prefer}
                disabled={disabled}
                onChange={(event) =>
                  onUpdate({
                    ...block,
                    rows: block.rows.map((item) =>
                      item.id === row.id ? { ...item, prefer: event.target.value } : item,
                    ),
                  })
                }
              />
              <button
                type="button"
                className="self-end rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                disabled={disabled || block.rows.length === 1}
                onClick={() =>
                  onUpdate({ ...block, rows: block.rows.filter((item) => item.id !== row.id) })
                }
                aria-label={`Удалить сравнение ${index + 1}`}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <Button
            size="sm"
            variant="secondary"
            disabled={disabled}
            onClick={() =>
              onUpdate({
                ...block,
                rows: [...block.rows, { id: createId(), avoid: '', prefer: '' }],
              })
            }
          >
            <Plus className="size-4" /> Добавить пару
          </Button>
        </div>
      );
    case 'takeaway':
      return (
        <div className="space-y-3">
          <Input
            label="Заголовок"
            value={block.title}
            disabled={disabled}
            onChange={(event) => onUpdate({ ...block, title: event.target.value })}
          />
          <Textarea
            label="Вывод"
            rows={3}
            value={block.body}
            disabled={disabled}
            onChange={(event) => onUpdate({ ...block, body: event.target.value })}
          />
        </div>
      );
    case 'steps':
    case 'checklist':
      return <ItemsBlockEditor block={block} disabled={disabled} onUpdate={onUpdate} />;
    case 'practice':
      return (
        <div className="space-y-3">
          <Input
            label="Заголовок"
            value={block.title}
            disabled={disabled}
            onChange={(event) => onUpdate({ ...block, title: event.target.value })}
          />
          <Textarea
            label="Контекст"
            rows={2}
            value={block.description}
            disabled={disabled}
            onChange={(event) => onUpdate({ ...block, description: event.target.value })}
          />
          <Textarea
            label="Что нужно сделать"
            rows={3}
            value={block.action}
            disabled={disabled}
            onChange={(event) => onUpdate({ ...block, action: event.target.value })}
          />
        </div>
      );
  }
}

function ItemsBlockEditor({
  block,
  disabled,
  onUpdate,
}: {
  block: LessonStepsBlock | LessonChecklistBlock;
  disabled?: boolean;
  onUpdate: (block: LessonBlock) => void;
}) {
  return (
    <div className="space-y-3">
      <Input
        label="Заголовок"
        value={block.title}
        disabled={disabled}
        onChange={(event) => onUpdate({ ...block, title: event.target.value })}
      />
      <div className="space-y-2">
        {block.items.map((item, index) => (
          <div key={item.id} className="flex items-end gap-2">
            <Input
              className="flex-1"
              label={`${block.kind === 'steps' ? 'Шаг' : 'Пункт'} ${index + 1}`}
              value={item.text}
              disabled={disabled}
              onChange={(event) =>
                onUpdate({
                  ...block,
                  items: block.items.map((entry) =>
                    entry.id === item.id ? { ...entry, text: event.target.value } : entry,
                  ),
                })
              }
            />
            <button
              type="button"
              className="mb-0.5 rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
              disabled={disabled || block.items.length === 1}
              onClick={() =>
                onUpdate({ ...block, items: block.items.filter((entry) => entry.id !== item.id) })
              }
              aria-label={`Удалить пункт ${index + 1}`}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
      <Button
        size="sm"
        variant="secondary"
        disabled={disabled}
        onClick={() =>
          onUpdate({ ...block, items: [...block.items, { id: createId(), text: '' }] })
        }
      >
        <Plus className="size-4" /> Добавить пункт
      </Button>
    </div>
  );
}
