import { queryKeys } from '@/api/queryKeys';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  CircleDot,
  FileText,
  KanbanSquare,
  LinkIcon,
  MessageSquare,
  Paperclip,
  Plus,
  Search,
  Send,
  UserRound,
  X,
} from 'lucide-react';
import { kbApi, orgApi, tasksApi } from '@/api';
import type { ChecklistItem, ID, Task, TaskColumn, User } from '@/types';
import { formatDate, formatRelativeDate } from '@/lib/format';
import { fullName } from '@/lib/labels';
import { plainTextToRichText, richTextToPlainText } from '@/lib/richText';
import { boardStats, buildBoardColumns, isOverdue, isStuck, workColumnIds } from '@/lib/taskBoard';
import { toast } from '@/stores/toast';
import {
  Avatar,
  Badge,
  Button,
  Drawer,
  Input,
  Modal,
  MultiSelect,
  RichTextView,
  Select,
  Tabs,
  Textarea,
} from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { cn } from '@/lib/cn';
import { createId } from '@/lib/id';

const emptyColumns: TaskColumn[] = [];
const emptyTasks: Task[] = [];
const emptyUsers: User[] = [];

const sourceTypeLabels = {
  task: 'CRM-задача',
  contact: 'Контакт',
  company: 'Компания',
  deal: 'Сделка',
} satisfies Record<NonNullable<Task['source']>['type'], string>;

function toDateInput(iso?: string) {
  return iso ? new Date(iso).toISOString().slice(0, 10) : '';
}

function fromDateInput(value: string) {
  return value ? new Date(`${value}T12:00:00`).toISOString() : '';
}

function pluralRu(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function StatChip({
  label,
  value,
  variant,
}: {
  label: string;
  value: number | string;
  variant: 'primary' | 'warning' | 'danger' | 'success';
}) {
  const variantClasses = {
    primary: 'border-primary-100 bg-primary-50 text-primary-800',
    warning: 'border-warning-100 bg-warning-50 text-warning-800',
    danger: 'border-danger-100 bg-danger-50 text-danger-800',
    success: 'border-success-100 bg-success-50 text-success-800',
  } satisfies Record<typeof variant, string>;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm',
        variantClasses[variant],
      )}
    >
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <span className="font-mono font-bold">{value}</span>
    </div>
  );
}

function TaskCard({
  task,
  usersById,
  stuck,
  onOpen,
}: {
  task: Task;
  usersById: Map<ID, User>;
  stuck: boolean;
  onOpen: () => void;
}) {
  const checklistDone = task.checklist.filter((item) => item.done).length;
  const assignees = task.assigneeIds
    .map((userId) => usersById.get(userId))
    .filter((user): user is User => Boolean(user))
    .slice(0, 3);

  return (
    <div className="group relative overflow-hidden rounded-lg border border-slate-200 bg-surface shadow-card transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-popover">
      <button type="button" onClick={onOpen} className="block w-full p-3 pb-2 text-left">
        <p className="line-clamp-2 text-sm leading-5 font-semibold text-slate-950">{task.title}</p>
      </button>

      {(isOverdue(task) || stuck) && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
          {isOverdue(task) && <Badge variant="danger">Просрочено</Badge>}
          {stuck && <Badge variant="warning">Застряла</Badge>}
        </div>
      )}

      {task.source && (
        <div className="px-3 pb-3">
          <a
            href={task.source.url || '#'}
            onClick={(event) => {
              if (!task.source?.url) event.preventDefault();
            }}
            className="inline-flex max-w-full items-center gap-1.5 text-xs font-medium text-primary-700 hover:text-primary-800"
          >
            <LinkIcon className="size-3.5 shrink-0" />
            <span className="truncate">
              {sourceTypeLabels[task.source.type]}: {task.source.title}
            </span>
          </a>
          {(task.source.funnelName || task.source.stageName) && (
            <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-slate-500">
              <span className="truncate">{task.source.funnelName ?? 'Без воронки'}</span>
              <span className="text-slate-300">/</span>
              <span className="truncate">{task.source.stageName ?? 'Без этапа'}</span>
            </div>
          )}
        </div>
      )}

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
  workIds,
  onOpenTask,
  onCreateTask,
}: {
  column: TaskColumn;
  tasks: Task[];
  usersById: Map<ID, User>;
  workIds: ReadonlySet<ID>;
  onOpenTask: (id: ID) => void;
  onCreateTask: (columnId: ID) => void;
}) {
  return (
    <section className="flex max-h-full min-h-80 w-80 shrink-0 flex-col rounded-lg border border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <CircleDot className="size-4 shrink-0 text-slate-400" />
          <h3 className="truncate text-sm font-semibold text-slate-900">{column.name}</h3>
          <Badge variant="neutral">{tasks.length}</Badge>
        </div>
        <button
          type="button"
          aria-label={`Добавить задачу в колонку ${column.name}`}
          onClick={() => onCreateTask(column.id)}
          className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-primary-600"
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
            stuck={isStuck(task, workIds)}
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

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: typeof FileText;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.5px] text-slate-400 uppercase">
      <Icon className="size-3.5" />
      {children}
    </div>
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
  const usersQuery = useQuery({ queryKey: queryKeys.users.all, queryFn: orgApi.getUsers });
  const articlesQuery = useQuery({
    queryKey: queryKeys.kb.articles,
    queryFn: () => kbApi.getArticles(),
  });
  const commentsQuery = useQuery({
    queryKey: queryKeys.tasks.commentsFor(task?.id),
    queryFn: () => tasksApi.getComments(task!.id),
    enabled: open && Boolean(task),
  });

  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [linkedArticleIds, setLinkedArticleIds] = useState<ID[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (!open || !task) return;
    setTitle(task.title);
    setDueDate(toDateInput(task.dueDate));
    setLinkedArticleIds(task.linkedArticleIds);
    setChecklist(task.checklist);
  }, [open, task]);

  const updateTask = useMutation({
    mutationFn: tasksApi.updateTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      toast.success('Задача сохранена');
    },
  });

  const addComment = useMutation({
    mutationFn: tasksApi.addComment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.board('comments') });
      setComment('');
      toast.success('Комментарий добавлен');
    },
  });

  const save = () => {
    if (!task || !title.trim()) return;
    updateTask.mutate({
      id: task.id,
      title: title.trim(),
      dueDate: fromDateInput(dueDate),
      linkedArticleIds,
      checklist,
    });
  };

  const checklistDone = checklist.filter((item) => item.done).length;
  const overdue =
    Boolean(dueDate) &&
    !task?.completedAt &&
    new Date(`${dueDate}T23:59:59`).getTime() < Date.now();
  const comments = commentsQuery.data ?? [];
  const currentColumnName = columns.find((column) => column.id === task?.columnId)?.name ?? '—';
  const assignee = usersQuery.data?.find((user) => user.id === task?.assigneeIds[0]);
  const articles = articlesQuery.data ?? [];
  const linkedArticles = articles.filter((article) => linkedArticleIds.includes(article.id));
  const availableArticles = articles.filter((article) => !linkedArticleIds.includes(article.id));

  const linkArticle = (articleId: ID) => {
    setLinkedArticleIds((ids) => (ids.includes(articleId) ? ids : [...ids, articleId]));
  };

  const unlinkArticle = (articleId: ID) => {
    setLinkedArticleIds((ids) => ids.filter((id) => id !== articleId));
  };

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
        task
          ? `Создана ${formatDate(task.createdAt)} · обновлена ${formatRelativeDate(task.updatedAt)}`
          : undefined
      }
      size="xl"
      footer={
        <>
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
                        { id: createId(), text: newChecklistText.trim(), done: false },
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
                        { id: createId(), text: newChecklistText.trim(), done: false },
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
                    toast.success(
                      'Мок-загрузка: файл появится после подключения реального хранилища',
                    )
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
                      <Avatar
                        name={author ? fullName(author) : '?'}
                        src={author?.avatarUrl}
                        size="sm"
                      />
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
                      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey))
                        submitComment();
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

          <aside className="space-y-5 lg:border-l lg:border-slate-100 lg:pl-6">
            <div className="text-[11px] font-bold tracking-[0.5px] text-slate-400 uppercase">
              Свойства
            </div>
            <div>
              <div className="mb-1.5 text-xs font-semibold text-slate-700">Статус</div>
              <div className="rounded-md border border-slate-200 bg-surface-muted px-3 py-2 text-sm font-medium text-slate-700">
                {currentColumnName}
              </div>
            </div>
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

            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <UserRound className="size-3.5 text-slate-400" />
                Исполнитель
              </div>
              <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-surface-muted px-3 py-2 text-sm text-slate-700">
                {assignee ? (
                  <>
                    <Avatar name={fullName(assignee)} src={assignee.avatarUrl} size="xs" />
                    <span className="min-w-0 truncate font-medium">{fullName(assignee)}</span>
                  </>
                ) : (
                  <span className="text-slate-400">Не назначен</span>
                )}
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <LinkIcon className="size-3.5 text-slate-400" />
                Статьи
              </div>
              <div className="space-y-2">
                {linkedArticles.length > 0 ? (
                  <div className="space-y-1.5">
                    {linkedArticles.map((article) => (
                      <div
                        key={article.id}
                        className="flex items-start gap-2 rounded-md border border-slate-200 bg-surface px-2.5 py-2"
                      >
                        <Link
                          to={{
                            pathname: '/knowledge',
                            search: `?article=${encodeURIComponent(article.id)}`,
                          }}
                          className="flex min-w-0 flex-1 items-start gap-2 rounded-sm text-sm leading-5 text-slate-700 hover:text-primary-700"
                        >
                          <FileText className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
                          <span className="min-w-0 flex-1 truncate">{article.title}</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => unlinkArticle(article.id)}
                          className="shrink-0 rounded p-0.5 text-slate-300 hover:bg-slate-100 hover:text-danger-600"
                          aria-label="Убрать связь со статьёй"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400">
                    Статьи не связаны
                  </div>
                )}
                <Select
                  value="none"
                  onValueChange={(value) => {
                    if (value !== 'none') linkArticle(value);
                  }}
                  disabled={availableArticles.length === 0}
                  options={[
                    {
                      value: 'none',
                      label:
                        availableArticles.length === 0 ? 'Все статьи связаны' : 'Добавить статью',
                      disabled: true,
                    },
                    ...availableArticles.map((article) => ({
                      value: article.id,
                      label: article.title,
                    })),
                  ]}
                />
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
  const [view, setView] = useState('kanban');
  const [selectedTaskId, setSelectedTaskId] = useState<ID | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<ID[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [deadlineFilter, setDeadlineFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [columnOpen, setColumnOpen] = useState(false);
  const [columnName, setColumnName] = useState('');
  const [columnError, setColumnError] = useState<string>();
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskColumnId, setTaskColumnId] = useState<ID>('');
  const [taskErrors, setTaskErrors] = useState<Partial<Record<'title' | 'column', string>>>({});

  const boardsQuery = useQuery({
    queryKey: queryKeys.tasks.board('boards'),
    queryFn: tasksApi.getBoards,
  });
  const boardId = boardsQuery.data?.[0]?.id;
  const columnsQuery = useQuery({
    queryKey: queryKeys.tasks.columns(boardId),
    queryFn: () => tasksApi.getColumns(boardId!),
    enabled: Boolean(boardId),
  });
  const tasksQuery = useQuery({
    queryKey: queryKeys.tasks.board(boardId),
    queryFn: () => tasksApi.getTasks(boardId),
    enabled: Boolean(boardId),
  });
  const usersQuery = useQuery({ queryKey: queryKeys.users.all, queryFn: orgApi.getUsers });

  const columns = columnsQuery.data ?? emptyColumns;
  const tasks = tasksQuery.data ?? emptyTasks;
  const users = usersQuery.data ?? emptyUsers;
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  const assigneeScopedTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          assigneeFilter.length === 0 ||
          task.assigneeIds.some((assigneeId) => assigneeFilter.includes(assigneeId)),
      ),
    [assigneeFilter, tasks],
  );
  const stats = useMemo(
    () => boardStats(assigneeScopedTasks, columns),
    [assigneeScopedTasks, columns],
  );
  const workIds = useMemo(() => workColumnIds(columns), [columns]);
  const statsLoading =
    boardsQuery.isPending || (Boolean(boardId) && (tasksQuery.isPending || columnsQuery.isPending));
  const boardLoading =
    boardsQuery.isPending || (Boolean(boardId) && (columnsQuery.isPending || tasksQuery.isPending));
  const boardError =
    boardsQuery.isError || columnsQuery.isError || tasksQuery.isError || usersQuery.isError;

  const createColumn = useMutation({
    mutationFn: () => tasksApi.createColumn({ boardId: boardId!, name: columnName.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.columns(boardId) });
      setColumnOpen(false);
      setColumnName('');
      setColumnError(undefined);
      toast.success('Колонка создана');
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Не удалось создать колонку'),
  });

  const submitColumn = () => {
    if (!columnName.trim()) {
      setColumnError('Укажите название колонки');
      return;
    }
    createColumn.mutate();
  };

  const createTask = useMutation({
    mutationFn: () =>
      tasksApi.createTask({
        boardId: boardId!,
        columnId: taskColumnId,
        title: taskTitle.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.board(boardId) });
      setTaskOpen(false);
      setTaskTitle('');
      setTaskErrors({});
      toast.success('Задача создана');
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Не удалось создать задачу'),
  });

  const openTaskCreate = (columnId = columns[0]?.id ?? '') => {
    setTaskColumnId(columnId);
    setTaskTitle('');
    setTaskErrors({});
    setTaskOpen(true);
  };

  const submitTask = () => {
    const nextErrors: typeof taskErrors = {};
    if (!taskTitle.trim()) nextErrors.title = 'Укажите название задачи';
    if (!taskColumnId) nextErrors.column = 'Выберите колонку';
    setTaskErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    createTask.mutate();
  };

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    const now = Date.now();
    return assigneeScopedTasks.filter((task) => {
      if (
        query &&
        !`${task.title} ${richTextToPlainText(task.description)}`.toLowerCase().includes(query)
      ) {
        return false;
      }
      if (statusFilter === 'done' && !task.completedAt) return false;
      if (statusFilter === 'open' && task.completedAt) return false;
      if (deadlineFilter === '3d' || deadlineFilter === '7d') {
        const days = deadlineFilter === '3d' ? 3 : 7;
        const due = task.dueDate ? new Date(task.dueDate).getTime() : 0;
        if (!due || due > now + days * 86_400_000) return false;
      }
      return true;
    });
  }, [assigneeScopedTasks, deadlineFilter, search, statusFilter]);

  const boardColumns = useMemo(
    () => buildBoardColumns(columns, filteredTasks),
    [columns, filteredTasks],
  );

  const calendar = monthDays(filteredTasks);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-slate-200 bg-surface px-6 py-5">
        <PageHeader
          title="Задачи"
          description="Общая доска задач компании: бэклог, фокус на сегодня, работа и готовый результат."
          actions={
            boardId && (
              <>
                {columns.length > 0 && (
                  <Button onClick={() => openTaskCreate()}>
                    <Plus className="size-4" />
                    Создать задачу
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setColumnOpen(true)}>
                  Создать колонку
                </Button>
              </>
            )
          }
        />

        <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(220px,1fr)_220px_160px_160px]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Поиск задач…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9.5 w-full rounded-md border border-slate-200 bg-surface pr-3 pl-9 text-sm transition-colors focus:outline-2 focus:-outline-offset-1 focus:outline-primary-600"
            />
          </div>
          <MultiSelect
            values={assigneeFilter}
            onValuesChange={setAssigneeFilter}
            placeholder="Все сотрудники"
            formatCount={(count) =>
              `${count} ${pluralRu(count, 'сотрудник', 'сотрудника', 'сотрудников')}`
            }
            options={users.map((user) => ({ value: user.id, label: fullName(user) }))}
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
            value={deadlineFilter}
            onValueChange={setDeadlineFilter}
            options={[
              { value: 'all', label: 'Все сроки' },
              { value: '3d', label: '3 дня' },
              { value: '7d', label: '7 дней' },
            ]}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <StatChip label="В работе" value={statsLoading ? '—' : stats.inWork} variant="primary" />
          <StatChip label="На сегодня" value={statsLoading ? '—' : stats.today} variant="warning" />
          <StatChip
            label="Просрочено"
            value={statsLoading ? '—' : stats.overdue}
            variant="danger"
          />
          <StatChip
            label="Готово за 7 дней"
            value={statsLoading ? '—' : stats.doneLast7Days}
            variant="success"
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
                <>
                  {boardLoading && (
                    <div className="h-64 animate-pulse rounded-lg bg-slate-200/60" />
                  )}
                  {!boardLoading && boardError && (
                    <ErrorState
                      title="Не удалось загрузить доску задач"
                      onRetry={() => {
                        boardsQuery.refetch();
                        columnsQuery.refetch();
                        tasksQuery.refetch();
                        usersQuery.refetch();
                      }}
                    />
                  )}
                  {!boardLoading && !boardError && !boardId && (
                    <EmptyState
                      icon={KanbanSquare}
                      title="Доска задач не настроена"
                      description="Обратитесь к администратору: для компании не создана основная доска задач."
                    />
                  )}
                  {!boardLoading && !boardError && boardId && columns.length === 0 && (
                    <EmptyState
                      icon={KanbanSquare}
                      title="Создайте первую колонку"
                      description="Например, «Бэклог», «В работе» или «Готово». После этого на доске можно будет создавать задачи."
                      action={
                        <Button onClick={() => setColumnOpen(true)}>
                          <Plus className="size-4" />
                          Создать колонку
                        </Button>
                      }
                    />
                  )}
                  {!boardLoading && !boardError && columns.length > 0 && (
                    <div className="flex h-[calc(100dvh-260px)] gap-4 overflow-x-auto pb-3">
                      {boardColumns.map((view) => (
                        <KanbanColumn
                          key={view.column.id}
                          column={view.column}
                          tasks={view.tasks}
                          usersById={usersById}
                          workIds={workIds}
                          onOpenTask={setSelectedTaskId}
                          onCreateTask={openTaskCreate}
                        />
                      ))}
                    </div>
                  )}
                </>
              ),
            },
            {
              value: 'list',
              label: 'Список',
              content: (
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-surface shadow-card">
                  <table className="w-full min-w-[760px] text-left">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs tracking-wide text-slate-400 uppercase">
                        <th className="px-4 py-3 font-semibold">Задача</th>
                        <th className="px-4 py-3 font-semibold">Колонка</th>
                        <th className="px-4 py-3 font-semibold">Исполнитель</th>
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
                            <td className="px-4 py-3 text-sm text-slate-600">
                              {task.dueDate ? formatDate(task.dueDate) : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 text-slate-400">
                                {task.linkedArticleIds.length > 0 && (
                                  <FileText className="size-4" />
                                )}
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
                      <div
                        key={day}
                        className="bg-slate-50 px-2 py-2 text-xs font-semibold text-slate-500"
                      >
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
                          <div className="mb-2 text-xs font-medium text-slate-500">
                            {day.getDate()}
                          </div>
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
      <Modal
        open={columnOpen}
        onOpenChange={(open) => {
          setColumnOpen(open);
          if (!open) {
            setColumnName('');
            setColumnError(undefined);
          }
        }}
        title="Новая колонка"
        description="Колонки задают этапы движения задач по доске."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setColumnOpen(false)}>
              Отмена
            </Button>
            <Button loading={createColumn.isPending} onClick={submitColumn}>
              Создать
            </Button>
          </>
        }
      >
        <Input
          label="Название колонки"
          value={columnName}
          autoFocus
          error={columnError}
          placeholder="Например, Бэклог"
          onChange={(event) => {
            setColumnName(event.target.value);
            setColumnError(undefined);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submitColumn();
            }
          }}
        />
      </Modal>
      <Modal
        open={taskOpen}
        onOpenChange={(open) => {
          setTaskOpen(open);
          if (!open) {
            setTaskTitle('');
            setTaskErrors({});
          }
        }}
        title="Новая задача"
        description="Добавьте задачу в выбранную колонку."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTaskOpen(false)}>
              Отмена
            </Button>
            <Button loading={createTask.isPending} onClick={submitTask}>
              Создать
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Название задачи"
            value={taskTitle}
            autoFocus
            error={taskErrors.title}
            onChange={(event) => {
              setTaskTitle(event.target.value);
              setTaskErrors((current) => ({ ...current, title: undefined }));
            }}
          />
          <Select
            label="Колонка"
            value={taskColumnId}
            error={taskErrors.column}
            options={columns.map((column) => ({ value: column.id, label: column.name }))}
            onValueChange={(value) => {
              setTaskColumnId(value);
              setTaskErrors((current) => ({ ...current, column: undefined }));
            }}
          />
        </div>
      </Modal>
    </div>
  );
}
