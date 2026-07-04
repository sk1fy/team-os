import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DndContext, DragOverlay, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { useTitle } from '@reactuses/core';
import {
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  CircleDot,
  Eye,
  FileText,
  GripVertical,
  LinkIcon,
  ListFilter,
  MessageSquare,
  Paperclip,
  Plus,
  Repeat,
  RotateCcw,
  Search,
  Send,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { kbApi, orgApi, tasksApi } from '@/api';
import type { Board, ChecklistItem, ID, Label, RichTextContent, Task, TaskColumn, TaskPriority, User } from '@/types';
import { formatDate, formatRelativeDate } from '@/lib/format';
import { fullName, priorityLabels, priorityVariants } from '@/lib/labels';
import { plainTextToRichText, richTextToPlainText } from '@/lib/richText';
import { toast } from '@/stores/toast';
import {
  Avatar,
  Badge,
  Button,
  Drawer,
  Input,
  RichTextEditor,
  RichTextView,
  Select,
  Tabs,
  Textarea,
} from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { cn } from '@/lib/cn';

const emptyDoc: RichTextContent = { type: 'doc', content: [{ type: 'paragraph' }] };
const emptyBoards: Board[] = [];
const emptyColumns: TaskColumn[] = [];
const emptyTasks: Task[] = [];
const emptyLabels: Label[] = [];
const emptyUsers: User[] = [];

const priorityOptions: Array<{ value: TaskPriority; label: string }> = [
  { value: 'low', label: 'Низкий' },
  { value: 'medium', label: 'Средний' },
  { value: 'high', label: 'Высокий' },
  { value: 'urgent', label: 'Срочно' },
];

const priorityCardClasses: Record<TaskPriority, string> = {
  low: 'border-l-slate-300',
  medium: 'border-l-primary-400',
  high: 'border-l-warning-500',
  urgent: 'border-l-danger-500',
};

const priorityTextClasses: Record<TaskPriority, string> = {
  low: 'text-slate-500',
  medium: 'text-primary-700',
  high: 'text-warning-700',
  urgent: 'text-danger-700',
};

const labelDotClasses: Record<string, string> = {
  red: 'bg-danger-500',
  amber: 'bg-warning-500',
  sky: 'bg-sky-500',
  rose: 'bg-rose-500',
};

function toDateInput(iso?: string) {
  return iso ? new Date(iso).toISOString().slice(0, 10) : '';
}

function fromDateInput(value: string) {
  return value ? new Date(`${value}T12:00:00`).toISOString() : '';
}

function isOverdue(task: Task) {
  return Boolean(task.dueDate && !task.completedAt && new Date(task.dueDate).getTime() < Date.now());
}

function TaskCard({
  task,
  usersById,
  labelsById,
  onOpen,
}: {
  task: Task;
  usersById: Map<ID, User>;
  labelsById: Map<ID, Label>;
  onOpen: () => void;
}) {
  const draggable = useDraggable({
    id: task.id,
    data: { type: 'task', taskId: task.id, columnId: task.columnId, order: task.order },
  });
  const droppable = useDroppable({
    id: `task-over-${task.id}`,
    data: { type: 'task-over', taskId: task.id, columnId: task.columnId, order: task.order },
  });
  const setNodeRef = (node: HTMLElement | null) => {
    draggable.setNodeRef(node);
    droppable.setNodeRef(node);
  };

  const checklistDone = task.checklist.filter((item) => item.done).length;
  const visibleLabels = task.labelIds
    .map((labelId) => labelsById.get(labelId))
    .filter((label): label is Label => Boolean(label));
  const assignees = task.assigneeIds
    .map((userId) => usersById.get(userId))
    .filter((user): user is User => Boolean(user))
    .slice(0, 3);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: draggable.transform ? `translate3d(${draggable.transform.x}px, ${draggable.transform.y}px, 0)` : undefined }}
      className={cn(
        'group relative overflow-hidden rounded-lg border border-l-4 bg-surface shadow-card transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-popover',
        priorityCardClasses[task.priority],
        draggable.isDragging && 'opacity-40',
        droppable.isOver && 'border-primary-300 bg-primary-50/60',
      )}
    >
      <div className="p-3 pb-2">
        <div className="mb-2 flex items-start justify-between gap-2">
          <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
            <p className="line-clamp-2 text-sm font-semibold leading-5 text-slate-950">
              {task.title}
            </p>
          </button>
          <button
            type="button"
            {...draggable.attributes}
            {...draggable.listeners}
            className="cursor-grab rounded p-0.5 text-slate-300 opacity-70 transition-opacity hover:bg-slate-100 hover:text-slate-500 group-hover:opacity-100"
            aria-label="Перетащить задачу"
          >
            <GripVertical className="size-4" />
          </button>
        </div>

        <button type="button" onClick={onOpen} className="block w-full text-left">
          {task.description && (
            <p className="line-clamp-2 text-xs leading-5 text-slate-500">
              {richTextToPlainText(task.description)}
            </p>
          )}
        </button>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span
            className={cn(
              'text-[11px] font-semibold tracking-wide uppercase',
              priorityTextClasses[task.priority],
            )}
          >
            {priorityLabels[task.priority]}
          </span>
          {visibleLabels.map((label) => (
            <span
              key={label.id}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500"
            >
              <span
                className={cn('size-1.5 rounded-full', labelDotClasses[label.color] ?? 'bg-slate-400')}
              />
              {label.name}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-3 py-2 text-xs text-slate-500">
        <div className="flex min-w-0 items-center gap-2.5">
          {task.dueDate && (
            <span
              className={cn(
                'inline-flex items-center gap-1 whitespace-nowrap',
                isOverdue(task) && 'font-medium text-danger-600',
              )}
            >
              <CalendarDays className="size-3.5" />
              {formatRelativeDate(task.dueDate)}
            </span>
          )}
          {task.checklist.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <CheckSquare className="size-3.5" />
              {checklistDone}/{task.checklist.length}
            </span>
          )}
          {task.attachments.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Paperclip className="size-3.5" />
              {task.attachments.length}
            </span>
          )}
          {task.linkedArticleIds.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <LinkIcon className="size-3.5" />
              {task.linkedArticleIds.length}
            </span>
          )}
        </div>
        {assignees.length > 0 && (
          <div className="flex shrink-0 -space-x-1">
            {assignees.map((user) => (
                <Avatar
                  key={user.id}
                  name={fullName(user)}
                  src={user.avatarUrl}
                  size="xs"
                  className="ring-2 ring-white"
                />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KanbanColumn({
  column,
  tasks,
  usersById,
  labelsById,
  onOpenTask,
  onCreateTask,
}: {
  column: TaskColumn;
  tasks: Task[];
  usersById: Map<ID, User>;
  labelsById: Map<ID, Label>;
  onOpenTask: (id: ID) => void;
  onCreateTask: (columnId: ID) => void;
}) {
  const droppable = useDroppable({
    id: `column-${column.id}`,
    data: { type: 'column', columnId: column.id, order: tasks.length },
  });

  return (
    <section
      ref={droppable.setNodeRef}
      className={cn(
        'flex max-h-full min-h-80 w-80 shrink-0 flex-col rounded-lg border border-slate-200 bg-slate-50',
        droppable.isOver && 'border-primary-300 bg-primary-50/60',
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <CircleDot className="size-4 shrink-0 text-slate-400" />
          <h3 className="truncate text-sm font-semibold text-slate-900">{column.name}</h3>
          <Badge variant="neutral">{tasks.length}</Badge>
        </div>
        <button
          type="button"
          onClick={() => onCreateTask(column.id)}
          className="inline-flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-white hover:text-slate-700"
          aria-label="Добавить задачу"
        >
          <Plus className="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            usersById={usersById}
            labelsById={labelsById}
            onOpen={() => onOpenTask(task.id)}
          />
        ))}
        {tasks.length === 0 && (
          <div className="rounded-md border border-dashed border-slate-200 bg-white/70 p-4 text-center text-sm text-slate-400">
            Нет задач
          </div>
        )}
      </div>
    </section>
  );
}

/** Заголовок секции карточки задачи в стиле panel-sub дизайн-системы. */
function SectionLabel({ icon: Icon, children }: { icon: typeof FileText; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.5px] text-slate-400 uppercase">
      <Icon className="size-3.5" />
      {children}
    </div>
  );
}

/** Чип-переключатель для мультивыбора (исполнители, метки, статьи). */
function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex cursor-pointer items-center gap-1.5 rounded-sm border px-2 py-1 text-[13px] font-medium transition-colors',
        active
          ? 'border-primary-200 bg-primary-50 text-primary-700'
          : 'border-slate-200 bg-surface text-slate-600 hover:border-primary-200 hover:text-primary-600',
      )}
    >
      {children}
    </button>
  );
}

function TaskDrawer({
  task,
  open,
  onClose,
  columns,
}: {
  task?: Task;
  open: boolean;
  onClose: () => void;
  columns: TaskColumn[];
}) {
  const queryClient = useQueryClient();
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: orgApi.getUsers });
  const positionsQuery = useQuery({ queryKey: ['positions'], queryFn: orgApi.getPositions });
  const labelsQuery = useQuery({ queryKey: ['tasks', 'labels'], queryFn: tasksApi.getLabels });
  const articlesQuery = useQuery({ queryKey: ['kb', 'articles'], queryFn: () => kbApi.getArticles() });
  const commentsQuery = useQuery({
    queryKey: ['tasks', 'comments', task?.id],
    queryFn: () => tasksApi.getComments(task!.id),
    enabled: open && Boolean(task),
  });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState<RichTextContent>(emptyDoc);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [columnId, setColumnId] = useState<ID>('');
  const [dueDate, setDueDate] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<ID[]>([]);
  const [assigneePositionId, setAssigneePositionId] = useState<ID>('');
  const [watcherIds, setWatcherIds] = useState<ID[]>([]);
  const [labelIds, setLabelIds] = useState<ID[]>([]);
  const [linkedArticleIds, setLinkedArticleIds] = useState<ID[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [comment, setComment] = useState('');
  const [recurrence, setRecurrence] = useState('none');

  useEffect(() => {
    if (!open || !task) return;
    setTitle(task.title);
    setDescription(task.description ?? emptyDoc);
    setPriority(task.priority);
    setColumnId(task.columnId);
    setDueDate(toDateInput(task.dueDate));
    setAssigneeIds(task.assigneeIds);
    setAssigneePositionId(task.assigneePositionId ?? '');
    setWatcherIds(task.watcherIds);
    setLabelIds(task.labelIds);
    setLinkedArticleIds(task.linkedArticleIds);
    setChecklist(task.checklist);
    setRecurrence(task.recurrence?.frequency ?? 'none');
  }, [open, task]);

  const updateTask = useMutation({
    mutationFn: tasksApi.updateTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Задача сохранена');
    },
  });

  const moveTask = useMutation({
    mutationFn: tasksApi.moveTask,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const addComment = useMutation({
    mutationFn: tasksApi.addComment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'comments'] });
      setComment('');
      toast.success('Комментарий добавлен');
    },
  });

  const toggle = (values: ID[], id: ID, setter: (values: ID[]) => void) => {
    const next = new Set(values);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter([...next]);
  };

  const save = () => {
    if (!task || !title.trim()) return;
    if (columnId && columnId !== task.columnId) {
      moveTask.mutate({ taskId: task.id, columnId, order: 0 });
    }
    updateTask.mutate({
      id: task.id,
      title: title.trim(),
      description,
      priority,
      dueDate: fromDateInput(dueDate),
      assigneeIds,
      assigneePositionId: assigneePositionId || undefined,
      watcherIds,
      labelIds,
      linkedArticleIds,
      checklist,
      recurrence:
        recurrence === 'none'
          ? undefined
          : {
              frequency: recurrence as 'daily' | 'weekly' | 'monthly',
              interval: 1,
              weekdays: recurrence === 'weekly' ? [1] : undefined,
            },
    });
  };

  const toggleComplete = () => {
    if (!task) return;
    updateTask.mutate({ id: task.id, completedAt: task.completedAt ? '' : new Date().toISOString() });
  };

  const checklistDone = checklist.filter((item) => item.done).length;
  const overdue =
    Boolean(dueDate) && !task?.completedAt && new Date(`${dueDate}T23:59:59`).getTime() < Date.now();
  const comments = commentsQuery.data ?? [];

  const submitComment = () => {
    if (!task || !comment.trim()) return;
    addComment.mutate({ taskId: task.id, content: plainTextToRichText(comment.trim()) });
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Задача"
      description={
        task ? `Создана ${formatDate(task.createdAt)} · обновлена ${formatRelativeDate(task.updatedAt)}` : undefined
      }
      size="xl"
      footer={
        <>
          <Button
            variant="ghost"
            onClick={toggleComplete}
            className={task?.completedAt ? undefined : 'text-success-600 hover:bg-success-50'}
          >
            {task?.completedAt ? (
              <>
                <RotateCcw className="size-4" />
                Возобновить
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" />
                Завершить
              </>
            )}
          </Button>
          <div className="flex-1" />
          <Button variant="secondary" onClick={onClose}>
            Закрыть
          </Button>
          <Button onClick={save} loading={updateTask.isPending}>
            Сохранить
          </Button>
        </>
      }
    >
      {task && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_248px]">
          {/* Основная колонка */}
          <div className="min-w-0 space-y-6">
            <div>
              {task.completedAt && (
                <div className="mb-3 flex items-center gap-2 rounded-md bg-success-50 px-3 py-2 text-[13px] font-medium text-success-700">
                  <CheckCircle2 className="size-4" />
                  Завершена {formatDate(task.completedAt)}
                </div>
              )}
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Название задачи"
                className="-mx-2 w-[calc(100%+1rem)] rounded-md border border-transparent px-2 py-1.5 text-lg leading-snug font-bold text-ink transition-colors hover:border-slate-200 focus:border-transparent focus:outline-2 focus:-outline-offset-1 focus:outline-primary-600"
              />
            </div>

            <section>
              <div className="mb-2">
                <SectionLabel icon={FileText}>Описание</SectionLabel>
              </div>
              <RichTextEditor value={description} onChange={setDescription} minHeight={160} />
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <SectionLabel icon={CheckSquare}>Чек-лист</SectionLabel>
                {checklist.length > 0 && (
                  <span className="font-mono text-xs font-semibold text-slate-500">
                    {checklistDone}/{checklist.length}
                  </span>
                )}
              </div>
              {checklist.length > 0 && (
                <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-primary-500 transition-all"
                    style={{ width: `${(checklistDone / checklist.length) * 100}%` }}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    className="group flex items-center gap-2.5 rounded-md border border-slate-200 px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 accent-primary-600"
                      checked={item.done}
                      onChange={() =>
                        setChecklist((items) =>
                          items.map((current) =>
                            current.id === item.id ? { ...current, done: !current.done } : current,
                          ),
                        )
                      }
                    />
                    <span
                      className={cn(
                        'flex-1 text-sm',
                        item.done ? 'text-slate-400 line-through' : 'text-slate-700',
                      )}
                    >
                      {item.text}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setChecklist((items) => items.filter((current) => current.id !== item.id))
                      }
                      className="shrink-0 cursor-pointer text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger-600"
                      aria-label="Удалить пункт"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={newChecklistText}
                    onChange={(event) => setNewChecklistText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' || !newChecklistText.trim()) return;
                      setChecklist((items) => [
                        ...items,
                        { id: crypto.randomUUID(), text: newChecklistText.trim(), done: false },
                      ]);
                      setNewChecklistText('');
                    }}
                    placeholder="Новый пункт — Enter, чтобы добавить"
                    className="flex-1"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (!newChecklistText.trim()) return;
                      setChecklist((items) => [
                        ...items,
                        { id: crypto.randomUUID(), text: newChecklistText.trim(), done: false },
                      ]);
                      setNewChecklistText('');
                    }}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>
            </section>

            <section>
              <div className="mb-2">
                <SectionLabel icon={Paperclip}>Вложения</SectionLabel>
              </div>
              <div className="space-y-1.5">
                {task.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-2.5 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  >
                    <Paperclip className="size-4 shrink-0 text-slate-400" />
                    {attachment.name}
                  </div>
                ))}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    toast.success('Мок-загрузка: файл появится после подключения реального хранилища')
                  }
                >
                  <Plus className="size-4" />
                  Добавить файл
                </Button>
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2">
                <SectionLabel icon={MessageSquare}>Комментарии</SectionLabel>
                {comments.length > 0 && (
                  <span className="rounded-full bg-slate-100 px-1.5 text-xs font-semibold text-slate-500">
                    {comments.length}
                  </span>
                )}
              </div>
              <div className="space-y-4">
                {comments.map((item) => {
                  const author = usersQuery.data?.find((user) => user.id === item.authorId);
                  return (
                    <div key={item.id} className="flex gap-3">
                      <Avatar name={author ? fullName(author) : '?'} src={author?.avatarUrl} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            {author ? fullName(author) : 'Пользователь'}
                          </span>
                          <span className="text-xs text-slate-400">
                            {formatRelativeDate(item.createdAt)}
                          </span>
                        </div>
                        <div className="mt-1 rounded-md rounded-tl-sm bg-surface-muted px-3 py-2">
                          <RichTextView content={item.content} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div>
                  <Textarea
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submitComment();
                    }}
                    placeholder="Написать комментарий… (Cmd+Enter — отправить)"
                    rows={2}
                  />
                  <Button
                    size="sm"
                    className="mt-2"
                    loading={addComment.isPending}
                    disabled={!comment.trim()}
                    onClick={submitComment}
                  >
                    <Send className="size-3.5" />
                    Отправить
                  </Button>
                </div>
              </div>
            </section>
          </div>

          {/* Панель свойств */}
          <aside className="space-y-5 lg:border-l lg:border-slate-100 lg:pl-6">
            <div className="text-[11px] font-bold tracking-[0.5px] text-slate-400 uppercase">
              Свойства
            </div>
            <Select
              label="Статус"
              value={columnId}
              onValueChange={setColumnId}
              options={columns.map((column) => ({ value: column.id, label: column.name }))}
            />
            <Select
              label="Приоритет"
              value={priority}
              onValueChange={(value) => setPriority(value as TaskPriority)}
              options={priorityOptions}
            />
            <div>
              <Input
                label="Дедлайн"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
              {overdue && (
                <p className="mt-1.5 text-xs font-semibold text-danger-600">Срок истёк</p>
              )}
            </div>
            <Select
              label="Повторение"
              value={recurrence}
              onValueChange={setRecurrence}
              options={[
                { value: 'none', label: 'Нет' },
                { value: 'daily', label: 'Ежедневно' },
                { value: 'weekly', label: 'Еженедельно' },
                { value: 'monthly', label: 'Ежемесячно' },
              ]}
            />
            <Select
              label="Исполнитель по должности"
              value={assigneePositionId || 'none'}
              onValueChange={(value) => setAssigneePositionId(value === 'none' ? '' : value)}
              options={[
                { value: 'none', label: 'Не назначено' },
                ...(positionsQuery.data ?? []).map((position) => ({
                  value: position.id,
                  label: position.name,
                })),
              ]}
            />

            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <UserRound className="size-3.5 text-slate-400" />
                Исполнители
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(usersQuery.data ?? []).map((user) => (
                  <ToggleChip
                    key={user.id}
                    active={assigneeIds.includes(user.id)}
                    onClick={() => toggle(assigneeIds, user.id, setAssigneeIds)}
                  >
                    <Avatar name={fullName(user)} src={user.avatarUrl} size="xs" className="-ml-0.5" />
                    {user.firstName}
                  </ToggleChip>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <UsersRound className="size-3.5 text-slate-400" />
                Наблюдатели
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(usersQuery.data ?? []).map((user) => (
                  <ToggleChip
                    key={user.id}
                    active={watcherIds.includes(user.id)}
                    onClick={() => toggle(watcherIds, user.id, setWatcherIds)}
                  >
                    {user.firstName} {user.lastName[0]}.
                  </ToggleChip>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <ListFilter className="size-3.5 text-slate-400" />
                Метки
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(labelsQuery.data ?? []).map((label) => (
                  <ToggleChip
                    key={label.id}
                    active={labelIds.includes(label.id)}
                    onClick={() => toggle(labelIds, label.id, setLabelIds)}
                  >
                    <span
                      className={cn(
                        'size-2 rounded-full',
                        labelDotClasses[label.color] ?? 'bg-slate-400',
                      )}
                    />
                    {label.name}
                  </ToggleChip>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <LinkIcon className="size-3.5 text-slate-400" />
                Статьи БЗ
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(articlesQuery.data ?? []).map((article) => (
                  <ToggleChip
                    key={article.id}
                    active={linkedArticleIds.includes(article.id)}
                    onClick={() => toggle(linkedArticleIds, article.id, setLinkedArticleIds)}
                  >
                    <FileText className="size-3.5" />
                    {article.title}
                  </ToggleChip>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}
    </Drawer>
  );
}

function monthDays(tasks: Task[]) {
  const dates = tasks
    .filter((task) => task.dueDate)
    .map((task) => new Date(task.dueDate!))
    .sort((a, b) => a.getTime() - b.getTime());
  const base = dates[0] ?? new Date();
  const year = base.getFullYear();
  const month = base.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days: Date[] = [];
  for (let i = 1; i <= last.getDate(); i += 1) days.push(new Date(year, month, i));
  const pad = (first.getDay() + 6) % 7;
  return { title: first.toLocaleDateString('ru', { month: 'long', year: 'numeric' }), days, pad };
}

export function TasksPage() {
  useTitle('Задачи — TeamOS');
  const queryClient = useQueryClient();
  const [activeBoardId, setActiveBoardId] = useState<ID>('board-2');
  const [view, setView] = useState('kanban');
  const [selectedTaskId, setSelectedTaskId] = useState<ID | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [labelFilter, setLabelFilter] = useState('all');
  const [deadlineFilter, setDeadlineFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [activeDragTask, setActiveDragTask] = useState<Task | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const boardsQuery = useQuery({ queryKey: ['tasks', 'boards'], queryFn: tasksApi.getBoards });
  const columnsQuery = useQuery({
    queryKey: ['tasks', 'columns', activeBoardId],
    queryFn: () => tasksApi.getColumns(activeBoardId),
  });
  const tasksQuery = useQuery({
    queryKey: ['tasks', activeBoardId],
    queryFn: () => tasksApi.getTasks(activeBoardId),
  });
  const labelsQuery = useQuery({ queryKey: ['tasks', 'labels'], queryFn: tasksApi.getLabels });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: orgApi.getUsers });

  const boards = boardsQuery.data ?? emptyBoards;
  const columns = columnsQuery.data ?? emptyColumns;
  const tasks = tasksQuery.data ?? emptyTasks;
  const labels = labelsQuery.data ?? emptyLabels;
  const users = usersQuery.data ?? emptyUsers;
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const labelsById = useMemo(() => new Map(labels.map((label) => [label.id, label])), [labels]);
  const board = boards.find((item) => item.id === activeBoardId);

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (query && !`${task.title} ${richTextToPlainText(task.description)}`.toLowerCase().includes(query)) return false;
      if (assigneeFilter !== 'all' && !task.assigneeIds.includes(assigneeFilter)) return false;
      if (labelFilter !== 'all' && !task.labelIds.includes(labelFilter)) return false;
      if (statusFilter === 'done' && !task.completedAt) return false;
      if (statusFilter === 'open' && task.completedAt) return false;
      if (deadlineFilter === 'overdue' && !isOverdue(task)) return false;
      if (deadlineFilter === 'week') {
        const due = task.dueDate ? new Date(task.dueDate).getTime() : 0;
        if (!due || due > Date.now() + 7 * 86_400_000) return false;
      }
      return true;
    });
  }, [assigneeFilter, deadlineFilter, labelFilter, search, statusFilter, tasks]);

  const tasksByColumn = useMemo(() => {
    const map = new Map<ID, Task[]>();
    for (const column of columns) map.set(column.id, []);
    for (const task of filteredTasks) {
      const list = map.get(task.columnId) ?? [];
      list.push(task);
      map.set(task.columnId, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.order - b.order);
    return map;
  }, [columns, filteredTasks]);

  const createTask = useMutation({
    mutationFn: tasksApi.createTask,
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', activeBoardId] });
      setSelectedTaskId(task.id);
      toast.success('Задача создана');
    },
  });

  const createColumn = useMutation({
    mutationFn: tasksApi.createColumn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'columns'] });
      toast.success('Колонка добавлена');
    },
  });

  const moveTask = useMutation({
    mutationFn: tasksApi.moveTask,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', activeBoardId] });
      const previous = queryClient.getQueryData<Task[]>(['tasks', activeBoardId]);
      queryClient.setQueryData<Task[]>(['tasks', activeBoardId], (old) =>
        old?.map((task) =>
          task.id === input.taskId ? { ...task, columnId: input.columnId, order: input.order } : task,
        ),
      );
      return { previous };
    },
    onError: (error, _input, context) => {
      queryClient.setQueryData(['tasks', activeBoardId], context?.previous);
      toast.error(error instanceof Error ? error.message : 'Не удалось переместить задачу');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks', activeBoardId] }),
  });

  const handleDragStart = (event: DragStartEvent) => {
    const taskId = event.active.data.current?.taskId as ID | undefined;
    setActiveDragTask(tasks.find((task) => task.id === taskId) ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const taskId = event.active.data.current?.taskId as ID | undefined;
    const over = event.over?.data.current as { columnId?: ID; order?: number } | undefined;
    setActiveDragTask(null);
    if (!taskId || !over?.columnId) return;
    moveTask.mutate({ taskId, columnId: over.columnId, order: over.order ?? 0 });
  };

  const createQuickTask = (columnId: ID) => {
    const title = window.prompt('Название задачи');
    if (!title?.trim()) return;
    createTask.mutate({ boardId: activeBoardId, columnId, title: title.trim() });
  };

  const calendar = monthDays(filteredTasks);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-slate-200 bg-surface px-6 py-5">
        <PageHeader
          title="Задачи"
          description={board ? `${board.name}: канбан, список и календарь дедлайнов.` : undefined}
          actions={
            <>
              <Select
                value={activeBoardId}
                onValueChange={setActiveBoardId}
                options={boards.map((item: Board) => ({ value: item.id, label: item.name }))}
                className="w-56"
              />
              <Button
                variant="secondary"
                onClick={() => {
                  const name = window.prompt('Название колонки');
                  if (name?.trim()) createColumn.mutate({ boardId: activeBoardId, name: name.trim() });
                }}
              >
                <Plus className="size-4" />
                Колонка
              </Button>
            </>
          }
        />

        <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(220px,1fr)_160px_160px_160px_160px]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Поиск задач…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9.5 w-full rounded-md border border-slate-200 bg-surface pl-9 pr-3 text-sm transition-colors focus:outline-2 focus:-outline-offset-1 focus:outline-primary-600"
            />
          </div>
          <Select
            value={assigneeFilter}
            onValueChange={setAssigneeFilter}
            options={[{ value: 'all', label: 'Все люди' }, ...users.map((user) => ({ value: user.id, label: fullName(user) }))]}
          />
          <Select
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={[
              { value: 'all', label: 'Все статусы' },
              { value: 'open', label: 'Открытые' },
              { value: 'done', label: 'Завершённые' },
            ]}
          />
          <Select
            value={labelFilter}
            onValueChange={setLabelFilter}
            options={[{ value: 'all', label: 'Все метки' }, ...labels.map((label) => ({ value: label.id, label: label.name }))]}
          />
          <Select
            value={deadlineFilter}
            onValueChange={setDeadlineFilter}
            options={[
              { value: 'all', label: 'Все сроки' },
              { value: 'week', label: '7 дней' },
              { value: 'overdue', label: 'Просрочено' },
            ]}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-6">
        <Tabs
          value={view}
          onValueChange={setView}
          items={[
            {
              value: 'kanban',
              label: 'Канбан',
              content: (
                <DndContext
                  sensors={sensors}
                  collisionDetection={pointerWithin}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragCancel={() => setActiveDragTask(null)}
                >
                  <div className="flex h-[calc(100dvh-260px)] gap-4 overflow-x-auto pb-3">
                    {columns.map((column) => (
                      <KanbanColumn
                        key={column.id}
                        column={column}
                        tasks={tasksByColumn.get(column.id) ?? []}
                        usersById={usersById}
                        labelsById={labelsById}
                        onOpenTask={setSelectedTaskId}
                        onCreateTask={createQuickTask}
                      />
                    ))}
                  </div>
                  <DragOverlay>
                    {activeDragTask && (
                      <div className="w-80 rounded-lg border border-primary-200 bg-surface p-3 shadow-popover">
                        <p className="text-sm font-medium text-slate-900">{activeDragTask.title}</p>
                      </div>
                    )}
                  </DragOverlay>
                </DndContext>
              ),
            },
            {
              value: 'list',
              label: 'Список',
              content: (
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-surface shadow-card">
                  <table className="w-full min-w-[900px] text-left">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs tracking-wide text-slate-400 uppercase">
                        <th className="px-4 py-3 font-semibold">Задача</th>
                        <th className="px-4 py-3 font-semibold">Колонка</th>
                        <th className="px-4 py-3 font-semibold">Исполнители</th>
                        <th className="px-4 py-3 font-semibold">Приоритет</th>
                        <th className="px-4 py-3 font-semibold">Дедлайн</th>
                        <th className="px-4 py-3 font-semibold">Связи</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks
                        .slice()
                        .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
                        .map((task) => (
                          <tr
                            key={task.id}
                            onClick={() => setSelectedTaskId(task.id)}
                            className="cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50"
                          >
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium text-slate-900">{task.title}</p>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">
                              {columns.find((column) => column.id === task.columnId)?.name}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">
                              {task.assigneeIds
                                .map((id) => usersById.get(id))
                                .filter(Boolean)
                                .map((user) => fullName(user!))
                                .join(', ') || '—'}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={priorityVariants[task.priority]}>
                                {priorityLabels[task.priority]}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">
                              {task.dueDate ? formatDate(task.dueDate) : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 text-slate-400">
                                {task.watcherIds.length > 0 && <Eye className="size-4" />}
                                {task.recurrence && <Repeat className="size-4" />}
                                {task.linkedArticleIds.length > 0 && <FileText className="size-4" />}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ),
            },
            {
              value: 'calendar',
              label: 'Календарь',
              content: (
                <div className="rounded-lg border border-slate-200 bg-surface p-4 shadow-card">
                  <div className="mb-4 flex items-center gap-2">
                    <CalendarDays className="size-5 text-slate-400" />
                    <h2 className="capitalize">{calendar.title}</h2>
                  </div>
                  <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200">
                    {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (
                      <div key={day} className="bg-slate-50 px-2 py-2 text-xs font-semibold text-slate-500">
                        {day}
                      </div>
                    ))}
                    {Array.from({ length: calendar.pad }).map((_, index) => (
                      <div key={`pad-${index}`} className="min-h-28 bg-slate-50" />
                    ))}
                    {calendar.days.map((day) => {
                      const dayTasks = filteredTasks.filter(
                        (task) =>
                          task.dueDate &&
                          new Date(task.dueDate).toDateString() === day.toDateString(),
                      );
                      return (
                        <div key={day.toISOString()} className="min-h-28 bg-white p-2">
                          <div className="mb-2 text-xs font-medium text-slate-500">{day.getDate()}</div>
                          <div className="space-y-1">
                            {dayTasks.map((task) => (
                              <button
                                key={task.id}
                                type="button"
                                onClick={() => setSelectedTaskId(task.id)}
                                className="block w-full truncate rounded bg-primary-50 px-2 py-1 text-left text-xs text-primary-800 hover:bg-primary-100"
                              >
                                {task.title}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ),
            },
          ]}
        />
      </div>

      <TaskDrawer
        task={selectedTask}
        open={Boolean(selectedTask)}
        onClose={() => setSelectedTaskId(null)}
        columns={columns}
      />
    </div>
  );
}
