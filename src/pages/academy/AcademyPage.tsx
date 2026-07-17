import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useTitle } from '@reactuses/core';
import {
  Award,
  BookOpen,
  Check,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Folder,
  GraduationCap,
  GripVertical,
  Link2,
  LinkIcon,
  Lock,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  Unlink,
  UsersRound,
} from 'lucide-react';
import { academyApi, kbApi, orgApi } from '@/api';
import type {
  Article,
  ArticleSection,
  AssigneeType,
  Course,
  CourseProgress,
  CourseSection,
  ID,
  Lesson,
  LessonSourceMode,
  Quiz,
  QuizQuestion,
  RichTextContent,
  User,
} from '@/types';
import { formatDate, formatRelativeDate } from '@/lib/format';
import { copyText } from '@/lib/clipboard';
import { fullName } from '@/lib/labels';
import { plainTextToRichText } from '@/lib/richText';
import { createId } from '@/lib/id';
import { toast } from '@/stores/toast';
import {
  Avatar,
  Badge,
  Button,
  Drawer,
  Dropdown,
  Input,
  Modal,
  RichTextEditor,
  RichTextView,
  Select,
  Tabs,
  Textarea,
} from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { cn } from '@/lib/cn';

const emptyCourses: Course[] = [];
const emptySections: CourseSection[] = [];
const emptyLessons: Lesson[] = [];
const emptyProgress: CourseProgress[] = [];
const emptyUsers: User[] = [];
const emptyArticles: Article[] = [];
const emptyArticleSections: ArticleSection[] = [];
const emptyQuizzes: Quiz[] = [];

const statusLabels = {
  draft: 'Черновик',
  published: 'Опубликован',
} satisfies Record<Course['status'], string>;

const progressStatusLabels = {
  not_started: 'Не начат',
  in_progress: 'В процессе',
  completed: 'Завершён',
  overdue: 'Просрочен',
} satisfies Record<CourseProgress['status'], string>;

function pluralRu(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

const showApiError = (error: unknown) =>
  toast.error(error instanceof Error ? error.message : 'Что-то пошло не так. Попробуйте ещё раз.');

const copyCourseLink = async (courseId: ID) => {
  const copied = await copyText(`${window.location.origin}/learn/${courseId}`);
  if (copied) toast.success('Ссылка скопирована');
  else toast.error('Не удалось скопировать ссылку');
};

function progressPercent(courseId: ID, lessons: Lesson[], progress?: CourseProgress) {
  const courseLessons = lessons.filter((lesson) => lesson.courseId === courseId);
  if (courseLessons.length === 0) return 0;
  return Math.round(((progress?.completedLessonIds.length ?? 0) / courseLessons.length) * 100);
}

/** Разделы БЗ в порядке дерева с уровнем вложенности — для выбора источника курса. */
function flattenKbSections(sections: ArticleSection[]) {
  const result: Array<{ section: ArticleSection; depth: number }> = [];
  const walk = (parentId: ID | null, depth: number) => {
    sections
      .filter((section) => section.parentId === parentId)
      .sort((a, b) => a.order - b.order)
      .forEach((section) => {
        result.push({ section, depth });
        walk(section.id, depth + 1);
      });
  };
  walk(null, 0);
  return result;
}

function CourseCard({
  course,
  lessons,
  progress,
  active,
  onSelect,
  onOpenBuilder,
  onOpenPlayer,
}: {
  course: Course;
  lessons: Lesson[];
  progress?: CourseProgress;
  active: boolean;
  onSelect: () => void;
  onOpenBuilder: () => void;
  onOpenPlayer: () => void;
}) {
  const percent = progressPercent(course.id, lessons, progress);
  const courseLessons = lessons.filter((lesson) => lesson.courseId === course.id);
  const fromKbCount = courseLessons.filter((lesson) => lesson.sourceArticleId).length;
  const lessonsLine = [
    `${courseLessons.length} ${pluralRu(courseLessons.length, 'урок', 'урока', 'уроков')}`,
    fromKbCount > 0 ? `${fromKbCount} из БЗ` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        'cursor-pointer overflow-hidden rounded-lg border bg-surface text-left shadow-card transition-colors',
        active
          ? 'border-primary-300 ring-2 ring-primary-100'
          : 'border-slate-200 hover:border-primary-200',
      )}
    >
      <div className="flex h-24 items-start justify-between gap-2 bg-[linear-gradient(135deg,#EFF6F5,#DDEEEC_48%,#BBE2DF)] px-4 py-3">
        <Badge variant={course.status === 'published' ? 'success' : 'warning'}>
          {statusLabels[course.status]}
        </Badge>
        {fromKbCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-xs text-slate-600">
            <BookOpen className="size-3" />
            База знаний
          </span>
        )}
      </div>
      <div className="space-y-3 p-4">
        <div>
          <h3 className="line-clamp-2 text-base font-semibold text-slate-950">{course.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{course.description}</p>
        </div>
        <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
          <span>{lessonsLine}</span>
          <span>{course.sequential ? 'Последовательно' : 'Свободно'}</span>
        </div>
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-success-500" style={{ width: `${percent}%` }} />
          </div>
          <div className="mt-1 text-xs text-slate-500">{percent}% прохождения</div>
        </div>
      </div>
      <div className="flex items-center gap-1 border-t border-slate-100 px-2 py-1.5">
        <Button
          size="sm"
          variant="ghost"
          className="min-w-0 flex-1 px-2"
          onClick={(event) => {
            event.stopPropagation();
            onOpenBuilder();
          }}
        >
          <Pencil className="size-4 shrink-0" />
          <span className="truncate">Конструктор</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="min-w-0 flex-1 px-2"
          onClick={(event) => {
            event.stopPropagation();
            onOpenPlayer();
          }}
        >
          <Play className="size-4 shrink-0" />
          <span className="truncate">Пройти</span>
        </Button>
        {course.status === 'published' && (
          <Button
            size="sm"
            variant="ghost"
            className="size-8 shrink-0 px-0"
            aria-label="Скопировать ссылку на курс"
            title="Скопировать ссылку"
            onClick={(event) => {
              event.stopPropagation();
              copyCourseLink(course.id);
            }}
          >
            <Link2 className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function LessonDraggable({
  lesson,
  active,
  locked,
  onSelect,
}: {
  lesson: Lesson;
  active: boolean;
  locked?: boolean;
  onSelect: () => void;
}) {
  const draggable = useDraggable({
    id: lesson.id,
    data: { type: 'lesson', lessonId: lesson.id, sectionId: lesson.sectionId, order: lesson.order },
  });
  const droppable = useDroppable({
    id: `lesson-over-${lesson.id}`,
    data: { type: 'lesson-over', sectionId: lesson.sectionId, order: lesson.order },
  });
  const setNodeRef = (node: HTMLElement | null) => {
    draggable.setNodeRef(node);
    droppable.setNodeRef(node);
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex items-center gap-2 rounded-md border px-2 py-2 transition-colors',
        active ? 'border-primary-200 bg-primary-50' : 'border-slate-200 bg-surface',
        droppable.isOver && 'border-primary-300',
        draggable.isDragging && 'opacity-40',
      )}
    >
      <button
        type="button"
        {...draggable.attributes}
        {...draggable.listeners}
        className="cursor-grab rounded p-0.5 text-slate-300 hover:bg-slate-100 hover:text-slate-500"
        aria-label="Перетащить урок"
      >
        <GripVertical className="size-4" />
      </button>
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium text-slate-800">{lesson.title}</span>
        {lesson.sourceArticleId && (
          <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-500">
            {lesson.sourceMode === 'link' ? (
              <LinkIcon className="size-3" />
            ) : (
              <FileText className="size-3" />
            )}
            {lesson.sourceMode === 'link' ? 'Синхронизирован' : 'Копия статьи'}
          </span>
        )}
      </button>
      {locked && <Lock className="size-4 text-slate-300" />}
    </div>
  );
}

function CourseSettings({ course, onDelete }: { course?: Course; onDelete: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<Course['status']>('draft');
  const [sequential, setSequential] = useState(true);
  const [deadlineDays, setDeadlineDays] = useState('');

  useEffect(() => {
    if (!course) return;
    setTitle(course.title);
    setDescription(course.description ?? '');
    setStatus(course.status);
    setSequential(course.sequential);
    setDeadlineDays(course.deadlineDays ? String(course.deadlineDays) : '');
  }, [course]);

  const updateCourse = useMutation({
    mutationFn: academyApi.updateCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy', 'courses'] });
      toast.success('Настройки курса сохранены');
    },
    onError: showApiError,
  });

  if (!course) return null;

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-surface p-4 shadow-card">
      <Input label="Название" value={title} onChange={(event) => setTitle(event.target.value)} />
      <Textarea
        label="Описание"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        rows={3}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Статус"
          value={status}
          onValueChange={(value) => setStatus(value as Course['status'])}
          options={[
            { value: 'draft', label: 'Черновик' },
            { value: 'published', label: 'Опубликован' },
          ]}
        />
        <Input
          label="Дедлайн, дней"
          type="number"
          min={1}
          value={deadlineDays}
          onChange={(event) => setDeadlineDays(event.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={sequential}
          onChange={(event) => setSequential(event.target.checked)}
        />
        Последовательное прохождение
      </label>
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            loading={updateCourse.isPending}
            onClick={() =>
              title.trim() &&
              updateCourse.mutate({
                id: course.id,
                title: title.trim(),
                description,
                status,
                sequential,
                deadlineDays: Number(deadlineDays) || undefined,
              })
            }
          >
            Сохранить
          </Button>
          {course.status === 'published' && (
            <Button size="sm" variant="ghost" onClick={() => copyCourseLink(course.id)}>
              <Link2 className="size-4" />
              Ссылка
            </Button>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="whitespace-nowrap text-danger-600 hover:bg-danger-50"
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
          Удалить курс
        </Button>
      </div>
    </div>
  );
}

type CreateCourseMode = 'own' | 'kb';

function CreateCourseModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (course: Course) => void;
}) {
  const queryClient = useQueryClient();
  const sectionsQuery = useQuery({
    queryKey: ['kb', 'sections'],
    queryFn: kbApi.getSections,
    enabled: open,
  });
  const articlesQuery = useQuery({
    queryKey: ['kb', 'articles'],
    queryFn: () => kbApi.getArticles(),
    enabled: open,
  });

  const [mode, setMode] = useState<CreateCourseMode>('own');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sequential, setSequential] = useState(true);
  const [deadlineDays, setDeadlineDays] = useState('');
  const [sourceMode, setSourceMode] = useState<LessonSourceMode>('link');
  const [selectedArticleIds, setSelectedArticleIds] = useState<Set<ID>>(new Set());

  useEffect(() => {
    if (!open) return;
    setMode('own');
    setTitle('');
    setDescription('');
    setSequential(true);
    setDeadlineDays('');
    setSourceMode('link');
    setSelectedArticleIds(new Set());
  }, [open]);

  const kbSections = sectionsQuery.data ?? emptyArticleSections;
  const articles = articlesQuery.data ?? emptyArticles;
  const flatSections = useMemo(() => flattenKbSections(kbSections), [kbSections]);
  const articlesBySection = useMemo(() => {
    const map = new Map<ID, Article[]>();
    for (const { section } of flatSections) {
      map.set(
        section.id,
        articles
          .filter((article) => article.sectionId === section.id)
          .sort((a, b) => a.title.localeCompare(b.title, 'ru')),
      );
    }
    return map;
  }, [articles, flatSections]);

  const toggleArticle = (id: ID) =>
    setSelectedArticleIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSection = (section: ArticleSection) => {
    const sectionArticles = articlesBySection.get(section.id) ?? [];
    if (sectionArticles.length === 0) return;
    const allSelected = sectionArticles.every((article) => selectedArticleIds.has(article.id));
    setSelectedArticleIds((current) => {
      const next = new Set(current);
      sectionArticles.forEach((article) => {
        if (allSelected) next.delete(article.id);
        else next.add(article.id);
      });
      return next;
    });
    if (!allSelected && !title.trim()) setTitle(section.name);
  };

  const handleCreated = (course: Course) => {
    queryClient.invalidateQueries({ queryKey: ['academy'] });
    toast.success('Курс создан');
    onCreated(course);
  };

  const createOwn = useMutation({
    mutationFn: academyApi.createCourse,
    onSuccess: handleCreated,
    onError: showApiError,
  });
  const createFromKb = useMutation({
    mutationFn: academyApi.createCourseFromKb,
    onSuccess: handleCreated,
    onError: showApiError,
  });

  const pending = createOwn.isPending || createFromKb.isPending;
  const selectedCount = selectedArticleIds.size;
  const canSubmit = Boolean(title.trim()) && (mode === 'own' || selectedCount > 0);

  const submit = () => {
    if (!canSubmit || pending) return;
    const common = {
      title: title.trim(),
      description: description.trim() || undefined,
      sequential,
      deadlineDays: Number(deadlineDays) || undefined,
    };
    if (mode === 'own') {
      createOwn.mutate(common);
      return;
    }
    const sectionIds = flatSections
      .filter(({ section }) =>
        (articlesBySection.get(section.id) ?? []).some((article) =>
          selectedArticleIds.has(article.id),
        ),
      )
      .map(({ section }) => section.id);
    createFromKb.mutate({
      ...common,
      mode: sourceMode,
      sectionIds,
      articleIds: [...selectedArticleIds],
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Новый курс"
      description="Соберите курс с нуля или на основе материалов базы знаний."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button loading={pending} disabled={!canSubmit} onClick={submit}>
            {mode === 'kb' && selectedCount > 0
              ? `Создать курс · ${selectedCount} ${pluralRu(selectedCount, 'урок', 'урока', 'уроков')}`
              : 'Создать курс'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label
            className={cn(
              'cursor-pointer rounded-md border p-3 transition-colors',
              mode === 'own'
                ? 'border-primary-300 bg-primary-50/60'
                : 'border-slate-200 hover:border-primary-200',
            )}
          >
            <input
              type="radio"
              checked={mode === 'own'}
              onChange={() => setMode('own')}
              className="mr-2"
            />
            <span className="text-sm font-medium text-slate-900">Свой курс</span>
            <p className="mt-1 text-xs text-slate-500">
              Пустой курс: разделы и уроки добавите в конструкторе.
            </p>
          </label>
          <label
            className={cn(
              'cursor-pointer rounded-md border p-3 transition-colors',
              mode === 'kb'
                ? 'border-primary-300 bg-primary-50/60'
                : 'border-slate-200 hover:border-primary-200',
            )}
          >
            <input
              type="radio"
              checked={mode === 'kb'}
              onChange={() => setMode('kb')}
              className="mr-2"
            />
            <span className="text-sm font-medium text-slate-900">Из базы знаний</span>
            <p className="mt-1 text-xs text-slate-500">
              Разделы БЗ станут разделами курса, статьи — уроками.
            </p>
          </label>
        </div>

        <Input
          label="Название"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Например: Онбординг новичка"
        />
        <Textarea
          label="Описание"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
          placeholder="Кому и зачем нужен этот курс"
        />

        {mode === 'kb' && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label
                className={cn(
                  'cursor-pointer rounded-md border p-3 transition-colors',
                  sourceMode === 'link'
                    ? 'border-primary-300 bg-primary-50/60'
                    : 'border-slate-200',
                )}
              >
                <input
                  type="radio"
                  checked={sourceMode === 'link'}
                  onChange={() => setSourceMode('link')}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-slate-900">Ссылка</span>
                <p className="mt-1 text-xs text-slate-500">
                  Уроки всегда показывают актуальную версию статьи.
                </p>
              </label>
              <label
                className={cn(
                  'cursor-pointer rounded-md border p-3 transition-colors',
                  sourceMode === 'copy'
                    ? 'border-primary-300 bg-primary-50/60'
                    : 'border-slate-200',
                )}
              >
                <input
                  type="radio"
                  checked={sourceMode === 'copy'}
                  onChange={() => setSourceMode('copy')}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-slate-900">Копия</span>
                <p className="mt-1 text-xs text-slate-500">
                  Уроки отвязаны от БЗ, контент можно менять под курс.
                </p>
              </label>
            </div>

            <div className="rounded-md border border-slate-200">
              <div className="flex items-center justify-between rounded-t-md border-b border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                  Разделы и статьи
                </span>
                <span className="text-xs text-slate-500">
                  Выбрано: {selectedCount} {pluralRu(selectedCount, 'статья', 'статьи', 'статей')}
                </span>
              </div>
              <div className="max-h-72 space-y-0.5 overflow-y-auto p-2">
                {flatSections.map(({ section, depth }) => {
                  const sectionArticles = articlesBySection.get(section.id) ?? [];
                  const selectedInSection = sectionArticles.filter((article) =>
                    selectedArticleIds.has(article.id),
                  ).length;
                  return (
                    <div key={section.id} style={{ paddingLeft: depth * 16 }}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          disabled={sectionArticles.length === 0}
                          checked={
                            sectionArticles.length > 0 &&
                            selectedInSection === sectionArticles.length
                          }
                          ref={(element) => {
                            if (element) {
                              element.indeterminate =
                                selectedInSection > 0 && selectedInSection < sectionArticles.length;
                            }
                          }}
                          onChange={() => toggleSection(section)}
                        />
                        <Folder className="size-4 shrink-0 text-primary-500" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                          {section.name}
                        </span>
                        <span className="shrink-0 text-xs text-slate-400">
                          {sectionArticles.length > 0
                            ? `${selectedInSection}/${sectionArticles.length}`
                            : 'нет статей'}
                        </span>
                      </label>
                      {sectionArticles.map((article) => (
                        <label
                          key={article.id}
                          className="ml-6 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedArticleIds.has(article.id)}
                            onChange={() => toggleArticle(article.id)}
                          />
                          <FileText className="size-4 shrink-0 text-slate-400" />
                          <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                            {article.title}
                          </span>
                          {article.status === 'draft' && <Badge variant="warning">Черновик</Badge>}
                        </label>
                      ))}
                    </div>
                  );
                })}
                {flatSections.length === 0 && (
                  <p className="p-3 text-sm text-slate-500">
                    {sectionsQuery.isLoading
                      ? 'Загружаем базу знаний…'
                      : 'В базе знаний пока нет разделов.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Дедлайн, дней"
            type="number"
            min={1}
            value={deadlineDays}
            onChange={(event) => setDeadlineDays(event.target.value)}
            hint="Срок прохождения с момента назначения"
          />
          <label className="flex items-center gap-2 self-start pt-7 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={sequential}
              onChange={(event) => setSequential(event.target.checked)}
            />
            Последовательное прохождение
          </label>
        </div>
      </div>
    </Modal>
  );
}

function NameModal({
  open,
  title,
  label = 'Название',
  initial = '',
  loading,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  label?: string;
  initial?: string;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);

  useEffect(() => {
    if (open) setValue(initial);
  }, [initial, open]);

  const submit = () => {
    const trimmed = value.trim();
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button loading={loading} disabled={!value.trim()} onClick={submit}>
            Сохранить
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Input
          label={label}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoFocus
        />
      </form>
    </Modal>
  );
}

function ConfirmModal({
  open,
  title,
  description,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="danger" loading={loading} onClick={onConfirm}>
            Удалить
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{description}</p>
    </Modal>
  );
}

function ImportArticleModal({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (articleId: ID, mode: LessonSourceMode) => void;
}) {
  const articlesQuery = useQuery({
    queryKey: ['kb', 'articles'],
    queryFn: () => kbApi.getArticles(),
  });
  const sectionsQuery = useQuery({ queryKey: ['kb', 'sections'], queryFn: kbApi.getSections });
  const articles = articlesQuery.data ?? emptyArticles;
  const sections = sectionsQuery.data ?? emptyArticleSections;
  const [articleId, setArticleId] = useState('');
  const [mode, setMode] = useState<LessonSourceMode>('link');

  useEffect(() => {
    if (open && articles[0]) setArticleId(articles[0].id);
  }, [articles, open]);

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Импорт из базы знаний"
      description="Выберите режим связи урока со статьёй."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={() => articleId && onImport(articleId, mode)}>Импортировать</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Статья"
          value={articleId}
          onValueChange={setArticleId}
          options={articles.map((article) => {
            const section = sections.find((item) => item.id === article.sectionId);
            return {
              value: article.id,
              label: section ? `${article.title} — ${section.name}` : article.title,
            };
          })}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="rounded-md border border-slate-200 p-3">
            <input
              type="radio"
              checked={mode === 'link'}
              onChange={() => setMode('link')}
              className="mr-2"
            />
            <span className="text-sm font-medium text-slate-900">Ссылка</span>
            <p className="mt-1 text-xs text-slate-500">
              Контент синхронизирован с БЗ и не редактируется в уроке.
            </p>
          </label>
          <label className="rounded-md border border-slate-200 p-3">
            <input
              type="radio"
              checked={mode === 'copy'}
              onChange={() => setMode('copy')}
              className="mr-2"
            />
            <span className="text-sm font-medium text-slate-900">Копия</span>
            <p className="mt-1 text-xs text-slate-500">
              Урок отвязан от источника, контент можно менять.
            </p>
          </label>
        </div>
      </div>
    </Modal>
  );
}

function LessonEditor({
  lesson,
  onRequestImport,
  onRequestDelete,
}: {
  lesson: Lesson;
  onRequestImport: () => void;
  onRequestDelete: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(lesson.title);
  const [content, setContent] = useState<RichTextContent>(lesson.content);
  const [dirty, setDirty] = useState(false);
  const articlesQuery = useQuery({
    queryKey: ['kb', 'articles'],
    queryFn: () => kbApi.getArticles(),
  });
  const sourceArticle = articlesQuery.data?.find(
    (article) => article.id === lesson.sourceArticleId,
  );
  const isLinked = lesson.sourceMode === 'link' && Boolean(lesson.sourceArticleId);

  const updateLesson = useMutation({
    mutationFn: academyApi.updateLesson,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy', 'lessons'] });
      setDirty(false);
      toast.success('Изменения сохранены');
    },
    onError: showApiError,
  });

  const save = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    updateLesson.mutate({
      id: lesson.id,
      title: trimmed,
      ...(isLinked ? {} : { content }),
    });
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-surface p-4 shadow-card">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <Input
          label="Название урока"
          className="min-w-64 flex-1"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setDirty(true);
          }}
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            loading={updateLesson.isPending}
            disabled={!dirty || !title.trim()}
            onClick={save}
          >
            <Check className="size-4" />
            Сохранить
          </Button>
          <Dropdown
            trigger={
              <Button size="sm" variant="ghost" aria-label="Действия с уроком">
                <MoreHorizontal className="size-4" />
              </Button>
            }
            items={[
              { key: 'import', label: 'Импорт из БЗ', icon: BookOpen, onSelect: onRequestImport },
              ...(isLinked
                ? [
                    {
                      key: 'unlink',
                      label: 'Сделать копией',
                      icon: Unlink,
                      onSelect: () =>
                        updateLesson.mutate({
                          id: lesson.id,
                          sourceMode: 'copy',
                          content: lesson.content,
                        }),
                    },
                  ]
                : []),
              'separator' as const,
              {
                key: 'delete',
                label: 'Удалить урок',
                icon: Trash2,
                danger: true,
                onSelect: onRequestDelete,
              },
            ]}
          />
        </div>
      </div>

      {lesson.sourceArticleId && (
        <div
          className={cn(
            'mb-4 flex items-center gap-2 rounded-md px-3 py-2 text-sm',
            isLinked ? 'bg-primary-50 text-primary-900' : 'bg-slate-50 text-slate-600',
          )}
        >
          {isLinked ? (
            <LinkIcon className="size-4 shrink-0" />
          ) : (
            <FileText className="size-4 shrink-0" />
          )}
          {isLinked
            ? `Синхронизировано со статьёй «${sourceArticle?.title ?? '…'}» — правки в базе знаний подтягиваются автоматически.`
            : `Создан из статьи «${sourceArticle?.title ?? '…'}», контент независим.`}
        </div>
      )}

      {isLinked ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <RichTextView content={lesson.content} />
        </div>
      ) : (
        <RichTextEditor
          value={content}
          onChange={(next) => {
            setContent(next);
            setDirty(true);
          }}
          minHeight={360}
        />
      )}
    </div>
  );
}

function QuizBuilder({ lesson, quiz }: { lesson?: Lesson; quiz?: Quiz }) {
  const queryClient = useQueryClient();
  const [passingScore, setPassingScore] = useState(80);
  const [maxAttempts, setMaxAttempts] = useState('3');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);

  useEffect(() => {
    setPassingScore(quiz?.passingScore ?? 80);
    setMaxAttempts(quiz?.maxAttempts ? String(quiz.maxAttempts) : '3');
    setQuestions(quiz?.questions ?? []);
  }, [quiz, lesson?.id]);

  const saveQuiz = useMutation({
    mutationFn: academyApi.upsertQuiz,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy', 'quizzes'] });
      queryClient.invalidateQueries({ queryKey: ['academy', 'lessons'] });
      toast.success('Тест сохранён');
    },
    onError: showApiError,
  });

  if (!lesson) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-surface p-4 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-950">Тест урока</h3>
          <p className="text-sm text-slate-500">
            Одиночный, множественный выбор и открытые ответы.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            setQuestions((current) => [
              ...current,
              {
                id: createId(),
                type: 'single',
                text: 'Новый вопрос',
                options: [
                  { id: createId(), text: 'Вариант 1', correct: true },
                  { id: createId(), text: 'Вариант 2', correct: false },
                ],
              },
            ])
          }
        >
          <Plus className="size-4" />
          Вопрос
        </Button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Input
          label="Проходной балл, %"
          type="number"
          min={0}
          max={100}
          value={passingScore}
          onChange={(event) => setPassingScore(Number(event.target.value))}
        />
        <Input
          label="Попыток"
          type="number"
          min={1}
          value={maxAttempts}
          onChange={(event) => setMaxAttempts(event.target.value)}
        />
      </div>

      <div className="space-y-3">
        {questions.map((question) => (
          <div key={question.id} className="rounded-md border border-slate-200 p-3">
            <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
              <Select
                value={question.type}
                onValueChange={(value) =>
                  setQuestions((current) =>
                    current.map((item) =>
                      item.id === question.id
                        ? { ...item, type: value as QuizQuestion['type'] }
                        : item,
                    ),
                  )
                }
                options={[
                  { value: 'single', label: 'Один ответ' },
                  { value: 'multiple', label: 'Несколько' },
                  { value: 'open', label: 'Открытый' },
                ]}
              />
              <Input
                value={question.text}
                onChange={(event) =>
                  setQuestions((current) =>
                    current.map((item) =>
                      item.id === question.id ? { ...item, text: event.target.value } : item,
                    ),
                  )
                }
              />
            </div>
            {question.type !== 'open' && (
              <div className="mt-3 space-y-2">
                {question.options.map((option) => (
                  <label key={option.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={option.correct}
                      onChange={() =>
                        setQuestions((current) =>
                          current.map((item) =>
                            item.id === question.id
                              ? {
                                  ...item,
                                  options: item.options.map((currentOption) =>
                                    currentOption.id === option.id
                                      ? { ...currentOption, correct: !currentOption.correct }
                                      : currentOption,
                                  ),
                                }
                              : item,
                          ),
                        )
                      }
                    />
                    <input
                      value={option.text}
                      onChange={(event) =>
                        setQuestions((current) =>
                          current.map((item) =>
                            item.id === question.id
                              ? {
                                  ...item,
                                  options: item.options.map((currentOption) =>
                                    currentOption.id === option.id
                                      ? { ...currentOption, text: event.target.value }
                                      : currentOption,
                                  ),
                                }
                              : item,
                          ),
                        )
                      }
                      className="h-8 flex-1 rounded-md border border-slate-200 px-2 text-sm focus:outline-2 focus:-outline-offset-1 focus:outline-primary-600"
                    />
                  </label>
                ))}
              </div>
            )}
            {question.type === 'open' && (
              <p className="mt-3 rounded-md bg-warning-50 px-3 py-2 text-xs text-warning-700">
                Открытый ответ попадёт на ручную проверку автора курса.
              </p>
            )}
          </div>
        ))}
        {questions.length === 0 && (
          <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">
            В тесте пока нет вопросов.
          </p>
        )}
      </div>

      <Button
        className="mt-4"
        loading={saveQuiz.isPending}
        onClick={() =>
          saveQuiz.mutate({
            id: quiz?.id,
            lessonId: lesson.id,
            questions,
            passingScore,
            maxAttempts: Number(maxAttempts) || undefined,
          })
        }
      >
        Сохранить тест
      </Button>
    </div>
  );
}

function AssignmentModal({
  course,
  open,
  onClose,
}: {
  course?: Course;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: orgApi.getUsers });
  const positionsQuery = useQuery({ queryKey: ['positions'], queryFn: orgApi.getPositions });
  const departmentsQuery = useQuery({ queryKey: ['departments'], queryFn: orgApi.getDepartments });
  const [assigneeType, setAssigneeType] = useState<AssigneeType>('user');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');

  const assignCourse = useMutation({
    mutationFn: academyApi.assignCourse,
    onSuccess: (assignment) => {
      queryClient.invalidateQueries({ queryKey: ['academy', 'assignments'] });
      toast.success(
        assignment.inviteToken
          ? `Внешняя ссылка: /learn/${assignment.courseId}?token=${assignment.inviteToken}`
          : 'Курс назначен',
      );
      onClose();
    },
    onError: showApiError,
  });

  const options = useMemo(() => {
    if (assigneeType === 'user') {
      return (usersQuery.data ?? []).map((user) => ({ value: user.id, label: fullName(user) }));
    }
    if (assigneeType === 'position') {
      return (positionsQuery.data ?? []).map((position) => ({
        value: position.id,
        label: position.name,
      }));
    }
    if (assigneeType === 'department') {
      return (departmentsQuery.data ?? []).map((department) => ({
        value: department.id,
        label: department.name,
      }));
    }
    return [{ value: 'external', label: 'Внешняя ссылка' }];
  }, [assigneeType, departmentsQuery.data, positionsQuery.data, usersQuery.data]);

  useEffect(() => {
    setAssigneeId(options[0]?.value ?? '');
  }, [options]);

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Назначить курс"
      description={course?.title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button
            loading={assignCourse.isPending}
            onClick={() =>
              course &&
              assignCourse.mutate({
                courseId: course.id,
                assigneeType,
                assigneeId: assigneeType === 'external' ? undefined : assigneeId,
                dueDate: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : undefined,
              })
            }
          >
            Назначить
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Кому"
          value={assigneeType}
          onValueChange={(value) => setAssigneeType(value as AssigneeType)}
          options={[
            { value: 'user', label: 'Человек' },
            { value: 'position', label: 'Должность' },
            { value: 'department', label: 'Отдел' },
            { value: 'external', label: 'Внешний партнёр' },
          ]}
        />
        <Select
          label="Получатель"
          value={assigneeId}
          onValueChange={setAssigneeId}
          options={options}
        />
        <Input
          label="Дедлайн"
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
        />
      </div>
    </Modal>
  );
}

function CertificateDrawer({
  course,
  user,
  open,
  onClose,
}: {
  course?: Course;
  user?: User;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Drawer
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Сертификат"
      size="lg"
      footer={
        <Button variant="secondary" onClick={() => window.print()}>
          <Download className="size-4" />
          Печать / PDF
        </Button>
      }
    >
      <div className="flex min-h-[520px] flex-col items-center justify-center rounded-lg border-4 border-double border-primary-200 bg-[linear-gradient(135deg,#ffffff,#f8fafc)] p-10 text-center">
        <Award className="mb-6 size-16 text-warning-500" />
        <p className="text-sm font-semibold tracking-[0.24em] text-slate-400 uppercase">
          TeamOS Academy
        </p>
        <h2 className="mt-6 text-3xl font-bold text-slate-950">Сертификат</h2>
        <p className="mt-5 text-sm text-slate-500">подтверждает, что</p>
        <p className="mt-2 text-2xl font-semibold text-primary-800">
          {user ? fullName(user) : 'Сотрудник'}
        </p>
        <p className="mt-5 text-sm text-slate-500">прошёл курс</p>
        <p className="mt-2 text-xl font-semibold text-slate-950">{course?.title}</p>
        <p className="mt-8 text-sm text-slate-500">{formatDate(new Date().toISOString())}</p>
      </div>
    </Drawer>
  );
}

type NamePrompt =
  | { kind: 'section-create' }
  | { kind: 'section-rename'; sectionId: ID; initial: string }
  | { kind: 'lesson-create'; sectionId: ID };

type ConfirmTarget =
  | { kind: 'course'; id: ID; title: string }
  | { kind: 'section'; id: ID; title: string }
  | { kind: 'lesson'; id: ID; title: string };

export function AcademyPage() {
  useTitle('Академия — TeamOS');
  const queryClient = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [tab, setTab] = useState('catalog');
  const [selectedCourseId, setSelectedCourseId] = useState<ID>('course-1');
  const [selectedLessonId, setSelectedLessonId] = useState<ID | null>(null);
  const [activeDragLesson, setActiveDragLesson] = useState<Lesson | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [certificateOpen, setCertificateOpen] = useState(false);
  const [namePrompt, setNamePrompt] = useState<NamePrompt | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [courseSearch, setCourseSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Course['status']>('all');

  const coursesQuery = useQuery({
    queryKey: ['academy', 'courses'],
    queryFn: academyApi.getCourses,
  });
  const sectionsQuery = useQuery({
    queryKey: ['academy', 'sections', selectedCourseId],
    queryFn: () => academyApi.getCourseSections(selectedCourseId),
    enabled: Boolean(selectedCourseId),
  });
  const lessonsQuery = useQuery({
    queryKey: ['academy', 'lessons', selectedCourseId],
    queryFn: () => academyApi.getLessons(selectedCourseId),
    enabled: Boolean(selectedCourseId),
  });
  const allLessonsQuery = useQuery({
    queryKey: ['academy', 'lessons', 'all'],
    queryFn: () => academyApi.getLessons(),
  });
  const progressQuery = useQuery({
    queryKey: ['academy', 'progress'],
    queryFn: () => academyApi.getProgress(),
  });
  const assignmentsQuery = useQuery({
    queryKey: ['academy', 'assignments'],
    queryFn: academyApi.getAssignments,
  });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: orgApi.getUsers });
  const quizzesQuery = useQuery({
    queryKey: ['academy', 'quizzes'],
    queryFn: () => academyApi.getQuizzes(),
  });

  const courses = coursesQuery.data ?? emptyCourses;
  const sections = sectionsQuery.data ?? emptySections;
  const lessons = lessonsQuery.data ?? emptyLessons;
  const progress = progressQuery.data ?? emptyProgress;
  const users = usersQuery.data ?? emptyUsers;
  const quizzes = quizzesQuery.data ?? emptyQuizzes;
  const selectedCourse = courses.find((course) => course.id === selectedCourseId);
  const currentUser = users.find((user) => user.id === 'user-1') ?? users[0];
  const allLessons = allLessonsQuery.data ?? lessons;

  /** Уроки в порядке разделов курса — для плеера и последовательного режима. */
  const orderedLessons = useMemo(() => {
    const sectionOrder = new Map(sections.map((section) => [section.id, section.order]));
    return [...lessons].sort(
      (a, b) =>
        (sectionOrder.get(a.sectionId) ?? 0) - (sectionOrder.get(b.sectionId) ?? 0) ||
        a.order - b.order,
    );
  }, [lessons, sections]);

  const selectedLesson =
    orderedLessons.find((lesson) => lesson.id === selectedLessonId) ?? orderedLessons[0];
  const selectedProgress = progress.find(
    (item) => item.courseId === selectedCourseId && item.userId === (currentUser?.id ?? 'user-1'),
  );
  const selectedQuiz = quizzes.find((quiz) => quiz.id === selectedLesson?.quizId);

  const visibleCourses = useMemo(() => {
    const query = courseSearch.trim().toLowerCase();
    return courses.filter((course) => {
      if (statusFilter !== 'all' && course.status !== statusFilter) return false;
      if (!query) return true;
      return (
        course.title.toLowerCase().includes(query) ||
        (course.description ?? '').toLowerCase().includes(query)
      );
    });
  }, [courseSearch, courses, statusFilter]);

  // Не сбрасываем выбор во время рефетча: свежесозданного курса ещё нет в кэше.
  useEffect(() => {
    if (coursesQuery.isFetching) return;
    if (courses.length > 0 && !courses.some((course) => course.id === selectedCourseId)) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, coursesQuery.isFetching, selectedCourseId]);

  useEffect(() => {
    if (orderedLessons[0] && !orderedLessons.some((lesson) => lesson.id === selectedLessonId)) {
      setSelectedLessonId(orderedLessons[0].id);
    }
  }, [orderedLessons, selectedLessonId]);

  const createSection = useMutation({
    mutationFn: academyApi.createCourseSection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy', 'sections'] });
      setNamePrompt(null);
      toast.success('Раздел добавлен');
    },
    onError: showApiError,
  });

  const renameSection = useMutation({
    mutationFn: academyApi.updateCourseSection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy', 'sections'] });
      setNamePrompt(null);
      toast.success('Раздел переименован');
    },
    onError: showApiError,
  });

  const deleteSection = useMutation({
    mutationFn: academyApi.deleteCourseSection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy'] });
      setConfirmTarget(null);
      toast.success('Раздел удалён');
    },
    onError: showApiError,
  });

  const createLesson = useMutation({
    mutationFn: academyApi.createLesson,
    onSuccess: (lesson) => {
      queryClient.invalidateQueries({ queryKey: ['academy', 'lessons'] });
      setSelectedLessonId(lesson.id);
      setNamePrompt(null);
      toast.success('Урок добавлен');
    },
    onError: showApiError,
  });

  const deleteLesson = useMutation({
    mutationFn: academyApi.deleteLesson,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy'] });
      setConfirmTarget(null);
      toast.success('Урок удалён');
    },
    onError: showApiError,
  });

  const deleteCourse = useMutation({
    mutationFn: academyApi.deleteCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy'] });
      setConfirmTarget(null);
      toast.success('Курс удалён');
    },
    onError: showApiError,
  });

  const importArticle = useMutation({
    mutationFn: academyApi.updateLesson,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy', 'lessons'] });
      setImportOpen(false);
      toast.success('Урок связан со статьёй');
    },
    onError: showApiError,
  });

  const moveLesson = useMutation({
    mutationFn: academyApi.moveLesson,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['academy', 'lessons'] }),
    onError: showApiError,
  });

  const markComplete = useMutation({
    mutationFn: academyApi.markLessonComplete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy', 'progress'] });
      toast.success('Прогресс обновлён');
    },
    onError: showApiError,
  });

  const handleDragStart = (event: DragStartEvent) => {
    const lessonId = event.active.data.current?.lessonId as ID | undefined;
    setActiveDragLesson(lessons.find((lesson) => lesson.id === lessonId) ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const lessonId = event.active.data.current?.lessonId as ID | undefined;
    const over = event.over?.data.current as { sectionId?: ID; order?: number } | undefined;
    setActiveDragLesson(null);
    if (!lessonId || !over?.sectionId) return;
    moveLesson.mutate({ id: lessonId, sectionId: over.sectionId, order: over.order ?? 0 });
  };

  const handleNameSubmit = (value: string) => {
    if (!namePrompt) return;
    if (namePrompt.kind === 'section-create' && selectedCourse) {
      createSection.mutate({ courseId: selectedCourse.id, title: value });
    } else if (namePrompt.kind === 'section-rename') {
      renameSection.mutate({ id: namePrompt.sectionId, title: value });
    } else if (namePrompt.kind === 'lesson-create' && selectedCourse) {
      createLesson.mutate({
        courseId: selectedCourse.id,
        sectionId: namePrompt.sectionId,
        title: value,
        content: plainTextToRichText(
          'Новый урок. Добавьте материалы, примеры и контрольные вопросы.',
        ),
      });
    }
  };

  const handleConfirmDelete = () => {
    if (!confirmTarget) return;
    if (confirmTarget.kind === 'course') deleteCourse.mutate(confirmTarget.id);
    else if (confirmTarget.kind === 'section') deleteSection.mutate(confirmTarget.id);
    else deleteLesson.mutate(confirmTarget.id);
  };

  const exportCsv = () => {
    const rows = [
      ['Сотрудник', 'Курс', 'Статус', 'Прогресс'],
      ...progress.map((item) => {
        const user = users.find((candidate) => candidate.id === item.userId);
        const course = courses.find((candidate) => candidate.id === item.courseId);
        return [
          user ? fullName(user) : item.userId,
          course?.title ?? item.courseId,
          progressStatusLabels[item.status],
          `${progressPercent(item.courseId, allLessons, item)}%`,
        ];
      }),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    void navigator.clipboard.writeText(csv);
    toast.success('CSV скопирован в буфер обмена');
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <PageHeader
        title="Академия"
        description="Создавайте курсы с нуля или из базы знаний, назначайте команде и следите за прогрессом."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setAssignmentOpen(true)}
              disabled={!selectedCourse}
            >
              <Send className="size-4" />
              Назначить
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Курс
            </Button>
          </>
        }
      />

      <Tabs
        className="mt-6"
        value={tab}
        onValueChange={setTab}
        items={[
          {
            value: 'catalog',
            label: 'Каталог',
            content: (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative w-full max-w-xs">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      placeholder="Поиск курсов…"
                      value={courseSearch}
                      onChange={(event) => setCourseSearch(event.target.value)}
                      className="h-9.5 w-full rounded-md border border-slate-200 bg-surface pr-3 pl-9 text-sm transition-colors focus:outline-2 focus:-outline-offset-1 focus:outline-primary-600"
                    />
                  </div>
                  <Select
                    className="w-44"
                    value={statusFilter}
                    onValueChange={(value) => setStatusFilter(value as 'all' | Course['status'])}
                    options={[
                      { value: 'all', label: 'Все статусы' },
                      { value: 'published', label: 'Опубликованные' },
                      { value: 'draft', label: 'Черновики' },
                    ]}
                  />
                </div>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div>
                    {visibleCourses.length > 0 ? (
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {visibleCourses.map((course) => (
                          <CourseCard
                            key={course.id}
                            course={course}
                            lessons={allLessons}
                            progress={progress.find(
                              (item) =>
                                item.courseId === course.id && item.userId === currentUser?.id,
                            )}
                            active={course.id === selectedCourseId}
                            onSelect={() => setSelectedCourseId(course.id)}
                            onOpenBuilder={() => {
                              setSelectedCourseId(course.id);
                              setTab('builder');
                            }}
                            onOpenPlayer={() => {
                              setSelectedCourseId(course.id);
                              setTab('player');
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        icon={GraduationCap}
                        title={courses.length === 0 ? 'Курсов пока нет' : 'Ничего не найдено'}
                        description={
                          courses.length === 0
                            ? 'Создайте первый курс с нуля или соберите его из разделов базы знаний.'
                            : 'Попробуйте изменить запрос или фильтр по статусу.'
                        }
                        action={
                          courses.length === 0 ? (
                            <Button onClick={() => setCreateOpen(true)}>
                              <Plus className="size-4" />
                              Создать курс
                            </Button>
                          ) : undefined
                        }
                      />
                    )}
                  </div>
                  <aside className="space-y-4">
                    <div className="rounded-lg border border-slate-200 bg-surface p-4 shadow-card">
                      <div className="mb-3 flex items-center gap-2 font-semibold text-slate-950">
                        <GraduationCap className="size-5 text-primary-500" />
                        Мои назначенные
                      </div>
                      <div className="space-y-3">
                        {assignmentsQuery.data
                          ?.filter((assignment) => assignment.assigneeType !== 'external')
                          .map((assignment) => {
                            const course = courses.find((item) => item.id === assignment.courseId);
                            const itemProgress = progress.find(
                              (item) =>
                                item.courseId === assignment.courseId &&
                                item.userId === currentUser?.id,
                            );
                            return course ? (
                              <button
                                key={assignment.id}
                                type="button"
                                onClick={() => setSelectedCourseId(course.id)}
                                className="w-full rounded-md border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
                              >
                                <span className="block text-sm font-medium text-slate-900">
                                  {course.title}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {progressPercent(course.id, allLessons, itemProgress)}% · назначен{' '}
                                  {formatRelativeDate(assignment.createdAt)}
                                </span>
                              </button>
                            ) : null;
                          })}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-surface p-4 shadow-card">
                      <div className="mb-3 flex items-center gap-2 font-semibold text-slate-950">
                        <Sparkles className="size-5 text-warning-500" />
                        Черновик с AI
                      </div>
                      <p className="text-sm text-slate-500">
                        Место под генерацию структуры курса оставлено в конструкторе. Сейчас кнопка
                        готова как UI-заглушка.
                      </p>
                      <Button className="mt-3" variant="secondary" size="sm" disabled>
                        Сгенерировать черновик
                      </Button>
                    </div>
                  </aside>
                </div>
              </div>
            ),
          },
          {
            value: 'builder',
            label: 'Конструктор',
            content: (
              <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
                <div className="space-y-4">
                  <CourseSettings
                    course={selectedCourse}
                    onDelete={() =>
                      selectedCourse &&
                      setConfirmTarget({
                        kind: 'course',
                        id: selectedCourse.id,
                        title: selectedCourse.title,
                      })
                    }
                  />
                  <DndContext
                    sensors={sensors}
                    collisionDetection={pointerWithin}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragCancel={() => setActiveDragLesson(null)}
                  >
                    <div className="rounded-lg border border-slate-200 bg-surface p-4 shadow-card">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="text-base font-semibold text-slate-950">Структура курса</h3>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!selectedCourse}
                          onClick={() => setNamePrompt({ kind: 'section-create' })}
                        >
                          <Plus className="size-4" />
                          Раздел
                        </Button>
                      </div>
                      <div className="space-y-4">
                        {sections.map((section) => {
                          const sectionLessons = lessons.filter(
                            (lesson) => lesson.sectionId === section.id,
                          );
                          return (
                            <section
                              key={section.id}
                              className="rounded-md border border-slate-200 p-3"
                            >
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1 truncate font-medium text-slate-900">
                                  {section.title}
                                </div>
                                <div className="flex items-center">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    aria-label="Добавить урок"
                                    onClick={() =>
                                      setNamePrompt({
                                        kind: 'lesson-create',
                                        sectionId: section.id,
                                      })
                                    }
                                  >
                                    <Plus className="size-4" />
                                  </Button>
                                  <Dropdown
                                    trigger={
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        aria-label="Действия с разделом"
                                      >
                                        <MoreHorizontal className="size-4" />
                                      </Button>
                                    }
                                    items={[
                                      {
                                        key: 'rename',
                                        label: 'Переименовать',
                                        icon: Pencil,
                                        onSelect: () =>
                                          setNamePrompt({
                                            kind: 'section-rename',
                                            sectionId: section.id,
                                            initial: section.title,
                                          }),
                                      },
                                      'separator',
                                      {
                                        key: 'delete',
                                        label: 'Удалить раздел',
                                        icon: Trash2,
                                        danger: true,
                                        onSelect: () =>
                                          setConfirmTarget({
                                            kind: 'section',
                                            id: section.id,
                                            title: section.title,
                                          }),
                                      },
                                    ]}
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                {sectionLessons.map((lesson) => (
                                  <LessonDraggable
                                    key={lesson.id}
                                    lesson={lesson}
                                    active={lesson.id === selectedLesson?.id}
                                    onSelect={() => setSelectedLessonId(lesson.id)}
                                  />
                                ))}
                                {sectionLessons.length === 0 && (
                                  <div className="rounded-md border border-dashed border-slate-200 p-3 text-sm text-slate-400">
                                    Нет уроков
                                  </div>
                                )}
                              </div>
                            </section>
                          );
                        })}
                        {sections.length === 0 && (
                          <div className="rounded-md border border-dashed border-slate-200 p-4 text-sm text-slate-400">
                            Добавьте первый раздел, чтобы наполнить курс уроками.
                          </div>
                        )}
                      </div>
                    </div>
                    <DragOverlay>
                      {activeDragLesson && (
                        <div className="rounded-md border border-primary-200 bg-surface px-3 py-2 shadow-popover">
                          {activeDragLesson.title}
                        </div>
                      )}
                    </DragOverlay>
                  </DndContext>
                </div>

                <div className="space-y-4">
                  {selectedLesson ? (
                    <>
                      <LessonEditor
                        key={selectedLesson.id}
                        lesson={selectedLesson}
                        onRequestImport={() => setImportOpen(true)}
                        onRequestDelete={() =>
                          setConfirmTarget({
                            kind: 'lesson',
                            id: selectedLesson.id,
                            title: selectedLesson.title,
                          })
                        }
                      />
                      <QuizBuilder lesson={selectedLesson} quiz={selectedQuiz} />
                    </>
                  ) : (
                    <div className="rounded-lg border border-slate-200 bg-surface p-8 text-center text-sm text-slate-500 shadow-card">
                      Выберите урок в структуре курса или добавьте новый.
                    </div>
                  )}
                </div>
              </div>
            ),
          },
          {
            value: 'player',
            label: 'Прохождение',
            content: selectedCourse ? (
              <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
                <aside className="rounded-lg border border-slate-200 bg-surface p-4 shadow-card">
                  <div className="mb-3 text-sm font-semibold text-slate-950">
                    {selectedCourse?.title}
                  </div>
                  <div className="space-y-3">
                    {sections.map((section) => {
                      const sectionLessons = orderedLessons.filter(
                        (lesson) => lesson.sectionId === section.id,
                      );
                      if (sectionLessons.length === 0) return null;
                      return (
                        <div key={section.id}>
                          <div className="mb-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                            {section.title}
                          </div>
                          <div className="space-y-1">
                            {sectionLessons.map((lesson) => {
                              const index = orderedLessons.findIndex(
                                (item) => item.id === lesson.id,
                              );
                              const completed = selectedProgress?.completedLessonIds.includes(
                                lesson.id,
                              );
                              const previousComplete =
                                index === 0 ||
                                selectedProgress?.completedLessonIds.includes(
                                  orderedLessons[index - 1]?.id,
                                );
                              const locked = Boolean(
                                selectedCourse?.sequential && !previousComplete,
                              );
                              return (
                                <button
                                  key={lesson.id}
                                  type="button"
                                  disabled={locked}
                                  onClick={() => setSelectedLessonId(lesson.id)}
                                  className={cn(
                                    'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm',
                                    lesson.id === selectedLesson?.id
                                      ? 'bg-primary-50 text-primary-800'
                                      : 'hover:bg-slate-50',
                                    locked &&
                                      'cursor-not-allowed text-slate-300 hover:bg-transparent',
                                  )}
                                >
                                  {completed ? (
                                    <Check className="size-4 text-success-600" />
                                  ) : (
                                    <ChevronRight className="size-4" />
                                  )}
                                  <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                                  {locked && <Lock className="size-4" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </aside>
                <main className="rounded-lg border border-slate-200 bg-surface p-6 shadow-card">
                  {selectedLesson ? (
                    <>
                      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2>{selectedLesson.title}</h2>
                          {selectedQuiz && (
                            <p className="mt-1 text-sm text-slate-500">
                              Тест: {selectedQuiz.questions.length} вопросов, проходной балл{' '}
                              {selectedQuiz.passingScore}%
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          loading={markComplete.isPending}
                          onClick={() =>
                            selectedCourse &&
                            markComplete.mutate({
                              courseId: selectedCourse.id,
                              lessonId: selectedLesson.id,
                            })
                          }
                        >
                          <Check className="size-4" />
                          Завершить урок
                        </Button>
                      </div>
                      <RichTextView content={selectedLesson.content} />
                      {selectedQuiz && (
                        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
                          <h3 className="mb-3 text-base font-semibold text-slate-950">
                            Контрольный тест
                          </h3>
                          <div className="space-y-3">
                            {selectedQuiz.questions.map((question) => (
                              <div key={question.id} className="rounded-md bg-white p-3">
                                <p className="text-sm font-medium text-slate-900">
                                  {question.text}
                                </p>
                                {question.type === 'open' ? (
                                  <Textarea
                                    className="mt-2"
                                    rows={3}
                                    placeholder="Ответ для ручной проверки"
                                  />
                                ) : (
                                  <div className="mt-2 space-y-2">
                                    {question.options.map((option) => (
                                      <label
                                        key={option.id}
                                        className="flex items-center gap-2 text-sm"
                                      >
                                        <input
                                          type={question.type === 'single' ? 'radio' : 'checkbox'}
                                          name={question.id}
                                        />
                                        {option.text}
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex min-h-56 flex-col items-center justify-center text-center">
                      <BookOpen className="size-8 text-slate-300" />
                      <h2 className="mt-3 text-base font-semibold text-slate-950">
                        В курсе пока нет уроков
                      </h2>
                      <p className="mt-1 max-w-sm text-sm text-slate-500">
                        Добавьте разделы и уроки в конструкторе, чтобы курс можно было пройти.
                      </p>
                      <Button className="mt-4" size="sm" onClick={() => setTab('builder')}>
                        Открыть конструктор
                      </Button>
                    </div>
                  )}
                </main>
              </div>
            ) : (
              <EmptyState
                icon={BookOpen}
                title="Выберите курс для прохождения"
                description="Откройте курс из каталога или создайте новый, чтобы увидеть его уроки."
                action={<Button onClick={() => setTab('catalog')}>Перейти в каталог</Button>}
              />
            ),
          },
          {
            value: 'progress',
            label: 'Прогресс',
            content: (
              <div className="rounded-lg border border-slate-200 bg-surface shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                  <div className="flex items-center gap-2 font-semibold text-slate-950">
                    <UsersRound className="size-5 text-slate-400" />
                    Дашборд прогресса
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={progress.length === 0}
                    onClick={exportCsv}
                  >
                    <Download className="size-4" />
                    CSV
                  </Button>
                </div>
                {progress.length === 0 ? (
                  <div className="p-6">
                    <EmptyState
                      icon={UsersRound}
                      title="Данных о прогрессе пока нет"
                      description="Здесь появятся результаты после назначения курсов сотрудникам."
                      action={
                        <Button variant="secondary" onClick={() => setTab('catalog')}>
                          Перейти в каталог
                        </Button>
                      }
                    />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs tracking-wide text-slate-400 uppercase">
                          <th className="px-4 py-3 font-semibold">Сотрудник</th>
                          <th className="px-4 py-3 font-semibold">Курс</th>
                          <th className="px-4 py-3 font-semibold">Статус</th>
                          <th className="px-4 py-3 font-semibold">Прогресс</th>
                          <th className="px-4 py-3 font-semibold">Проверка</th>
                          <th className="px-4 py-3 font-semibold">Сертификат</th>
                        </tr>
                      </thead>
                      <tbody>
                        {progress.map((item) => {
                          const user = users.find((candidate) => candidate.id === item.userId);
                          const course = courses.find(
                            (candidate) => candidate.id === item.courseId,
                          );
                          const percent = progressPercent(item.courseId, allLessons, item);
                          const pendingReview = item.quizAttempts.some(
                            (attempt) => attempt.pendingReview,
                          );
                          return (
                            <tr
                              key={`${item.userId}-${item.courseId}`}
                              className="border-b border-slate-100 last:border-0"
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  {user && (
                                    <Avatar name={fullName(user)} src={user.avatarUrl} size="sm" />
                                  )}
                                  <span className="text-sm font-medium text-slate-900">
                                    {user ? fullName(user) : item.userId}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-600">{course?.title}</td>
                              <td className="px-4 py-3">
                                <Badge
                                  variant={item.status === 'completed' ? 'success' : 'primary'}
                                >
                                  {progressStatusLabels[item.status]}
                                </Badge>
                              </td>
                              <td className="px-4 py-3">
                                <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className="h-full bg-success-500"
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant={pendingReview ? 'warning' : 'neutral'}>
                                  {pendingReview ? 'Нужна' : 'Нет'}
                                </Badge>
                              </td>
                              <td className="px-4 py-3">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={item.status !== 'completed'}
                                  onClick={() => {
                                    if (course) setSelectedCourseId(course.id);
                                    setCertificateOpen(true);
                                  }}
                                >
                                  <Award className="size-4" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ),
          },
        ]}
      />

      <CreateCourseModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(course) => {
          setCreateOpen(false);
          setSelectedCourseId(course.id);
          setTab('builder');
        }}
      />

      <NameModal
        open={Boolean(namePrompt)}
        title={
          namePrompt?.kind === 'section-create'
            ? 'Новый раздел'
            : namePrompt?.kind === 'section-rename'
              ? 'Переименовать раздел'
              : 'Новый урок'
        }
        initial={namePrompt?.kind === 'section-rename' ? namePrompt.initial : ''}
        loading={createSection.isPending || renameSection.isPending || createLesson.isPending}
        onClose={() => setNamePrompt(null)}
        onSubmit={handleNameSubmit}
      />

      <ConfirmModal
        open={Boolean(confirmTarget)}
        title={
          confirmTarget?.kind === 'course'
            ? 'Удалить курс?'
            : confirmTarget?.kind === 'section'
              ? 'Удалить раздел?'
              : 'Удалить урок?'
        }
        description={
          confirmTarget?.kind === 'course'
            ? `Курс «${confirmTarget.title}» будет удалён вместе с разделами, уроками, тестами и прогрессом.`
            : confirmTarget?.kind === 'section'
              ? `Раздел «${confirmTarget.title}» будет удалён вместе со всеми уроками.`
              : `Урок «${confirmTarget?.title ?? ''}» будет удалён вместе с тестом.`
        }
        loading={deleteCourse.isPending || deleteSection.isPending || deleteLesson.isPending}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleConfirmDelete}
      />

      <ImportArticleModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={(articleId, mode) => {
          if (!selectedLesson) return;
          importArticle.mutate({
            id: selectedLesson.id,
            sourceArticleId: articleId,
            sourceMode: mode,
          });
        }}
      />
      <AssignmentModal
        course={selectedCourse}
        open={assignmentOpen}
        onClose={() => setAssignmentOpen(false)}
      />
      <CertificateDrawer
        course={selectedCourse}
        user={currentUser}
        open={certificateOpen}
        onClose={() => setCertificateOpen(false)}
      />
      {selectedCourse && (
        <div className="mt-4 text-right">
          <Link
            to={`/learn/${selectedCourse.id}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:text-primary-800"
          >
            Открыть внешний режим
            <ExternalLink className="size-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
