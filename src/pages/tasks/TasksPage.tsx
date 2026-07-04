import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DndContext, DragOverlay, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { useTitle } from '@reactuses/core';
import {
  CalendarDays,
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
  Search,
  UserRound,
  UsersRound,
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

  return (
    <div
      ref={setNodeRef}
      style={{ transform: draggable.transform ? `translate3d(${draggable.transform.x}px, ${draggable.transform.y}px, 0)` : undefined }}
      className={cn(
        'rounded-lg border border-slate-200 bg-surface p-3 shadow-card transition-colors',
        draggable.isDragging && 'opacity-40',
        droppable.isOver && 'border-primary-300 bg-primary-50/60',
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...draggable.attributes}
          {...draggable.listeners}
          className="mt-0.5 cursor-grab rounded p-0.5 text-slate-300 hover:bg-slate-100 hover:text-slate-500"
          aria-label="Перетащить задачу"
        >
          <GripVertical className="size-4" />
        </button>
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="line-clamp-2 text-sm font-medium text-slate-900">{task.title}</p>
          {task.description && (
            <p className="mt-1 line-clamp-2 text-xs text-slate-500">
              {richTextToPlainText(task.description)}
            </p>
          )}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge variant={priorityVariants[task.priority]}>{priorityLabels[task.priority]}</Badge>
        {task.labelIds.map((labelId) => {
          const label = labelsById.get(labelId);
          return label ? (
            <span
              key={labelId}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
            >
              {label.name}
            </span>
          ) : null;
        })}
        {task.dueDate && (
          <Badge variant={isOverdue(task) ? 'danger' : 'neutral'}>
            {formatRelativeDate(task.dueDate)}
          </Badge>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-3">
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
        <div className="flex -space-x-1">
          {task.assigneeIds.slice(0, 3).map((userId) => {
            const user = usersById.get(userId);
            return user ? (
              <Avatar
                key={userId}
                name={fullName(user)}
                src={user.avatarUrl}
                size="xs"
                className="ring-2 ring-white"
              />
            ) : null;
          })}
        </div>
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

  const linkedArticles = (articlesQuery.data ?? []).filter((article) => linkedArticleIds.includes(article.id));

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={task?.title ?? 'Задача'}
      description={task ? columns.find((column) => column.id === task.columnId)?.name : undefined}
      size="lg"
      footer={
        <>
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
        <div className="space-y-6">
          <Input label="Название" value={title} onChange={(event) => setTitle(event.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Приоритет"
              value={priority}
              onValueChange={(value) => setPriority(value as TaskPriority)}
              options={priorityOptions}
            />
            <Input
              label="Дедлайн"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </div>

          <section>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FileText className="size-4 text-slate-400" />
              Описание
            </div>
            <RichTextEditor value={description} onChange={setDescription} minHeight={180} />
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <UserRound className="size-4 text-slate-400" />
                Исполнители
              </div>
              <div className="space-y-2 rounded-md border border-slate-200 p-3">
                {(usersQuery.data ?? []).map((user) => (
                  <label key={user.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={assigneeIds.includes(user.id)}
                      onChange={() => toggle(assigneeIds, user.id, setAssigneeIds)}
                    />
                    {fullName(user)}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <UsersRound className="size-4 text-slate-400" />
                Наблюдатели
              </div>
              <div className="space-y-2 rounded-md border border-slate-200 p-3">
                {(usersQuery.data ?? []).map((user) => (
                  <label key={user.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={watcherIds.includes(user.id)}
                      onChange={() => toggle(watcherIds, user.id, setWatcherIds)}
                    />
                    {fullName(user)}
                  </label>
                ))}
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
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
          </div>

          <section>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ListFilter className="size-4 text-slate-400" />
              Метки
            </div>
            <div className="flex flex-wrap gap-2">
              {(labelsQuery.data ?? []).map((label) => (
                <label key={label.id} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={labelIds.includes(label.id)}
                    onChange={() => toggle(labelIds, label.id, setLabelIds)}
                  />
                  {label.name}
                </label>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <CheckSquare className="size-4 text-slate-400" />
              Чек-лист
            </div>
            <div className="space-y-2">
              {checklist.map((item) => (
                <label key={item.id} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() =>
                      setChecklist((items) =>
                        items.map((current) =>
                          current.id === item.id ? { ...current, done: !current.done } : current,
                        ),
                      )
                    }
                  />
                  <span className={cn(item.done && 'text-slate-400 line-through')}>{item.text}</span>
                </label>
              ))}
              <div className="flex gap-2">
                <Input
                  value={newChecklistText}
                  onChange={(event) => setNewChecklistText(event.target.value)}
                  placeholder="Новый пункт"
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
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <LinkIcon className="size-4 text-slate-400" />
              Статьи БЗ
            </div>
            <div className="space-y-2 rounded-md border border-slate-200 p-3">
              {(articlesQuery.data ?? []).map((article) => (
                <label key={article.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={linkedArticleIds.includes(article.id)}
                    onChange={() => toggle(linkedArticleIds, article.id, setLinkedArticleIds)}
                  />
                  {article.title}
                </label>
              ))}
            </div>
            {linkedArticles.length > 0 && (
              <div className="mt-3 grid gap-2">
                {linkedArticles.map((article) => (
                  <div key={article.id} className="rounded-md bg-primary-50 px-3 py-2 text-sm text-primary-900">
                    {article.title}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Paperclip className="size-4 text-slate-400" />
              Вложения
            </div>
            <div className="space-y-2">
              {task.attachments.map((attachment) => (
                <div key={attachment.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">
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
                <Paperclip className="size-4" />
                Добавить файл
              </Button>
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <MessageSquare className="size-4 text-slate-400" />
              Комментарии
            </div>
            <div className="space-y-3">
              {(commentsQuery.data ?? []).map((item) => {
                const author = usersQuery.data?.find((user) => user.id === item.authorId);
                return (
                  <div key={item.id} className="rounded-md border border-slate-200 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      {author && <Avatar name={fullName(author)} src={author.avatarUrl} size="xs" />}
                      <span className="text-sm font-medium text-slate-900">
                        {author ? fullName(author) : 'Пользователь'}
                      </span>
                      <span className="text-xs text-slate-400">{formatRelativeDate(item.createdAt)}</span>
                    </div>
                    <RichTextView content={item.content} />
                  </div>
                );
              })}
              <Textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Комментарий"
                rows={3}
              />
              <Button
                variant="secondary"
                size="sm"
                loading={addComment.isPending}
                onClick={() =>
                  comment.trim() &&
                  addComment.mutate({ taskId: task.id, content: plainTextToRichText(comment.trim()) })
                }
              >
                Добавить комментарий
              </Button>
            </div>
          </section>
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
              className="h-9 w-full rounded-md border border-slate-300 bg-surface pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary-400"
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
