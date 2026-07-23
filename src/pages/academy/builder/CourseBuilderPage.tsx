import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTitle } from '@reactuses/core';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleDot,
  Eye,
  FolderPlus,
  GripVertical,
  Link2,
  ListPlus,
  MoreHorizontal,
  Pencil,
  Save,
  Settings2,
  Trash2,
} from 'lucide-react';
import { academyCoursesApi, academyVersionsApi } from '@/api/academy';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import {
  Button,
  Badge,
  Drawer,
  Dropdown,
  type DropdownItem,
  Input,
  Modal,
  RichTextEditor,
} from '@/components/ui';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { academyRoutes, resolveCourseCapabilities } from '@/lib/academy';
import { cn } from '@/lib/cn';
import { plural } from '@/lib/format';
import { createId } from '@/lib/id';
import { toast } from '@/stores/toast';
import type { RichTextContent } from '@/types';
import type { CourseVersionAuthorDetail, LessonAuthor, QuizAuthor } from '@/types/academy';
import { authApi } from '@/api';
import { CourseSettingsDrawer } from './CourseSettingsDrawer';
import { PublishDialog, type PublishValidationIssue } from './PublishDialog';
import { QuizEditor, createEmptyQuiz, validateQuiz } from './QuizEditor';
import { useUnsavedChanges } from './useUnsavedChanges';

function countLessons(draft: CourseVersionAuthorDetail | undefined): number {
  return draft?.sections.reduce((sum, s) => sum + s.lessons.length, 0) ?? 0;
}

function hasLessonContent(content: RichTextContent | undefined): boolean {
  const nodes = content?.content;
  if (!nodes?.length) return false;

  const hasMeaningfulNode = (value: unknown): boolean => {
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.some(hasMeaningfulNode);
    if (!value || typeof value !== 'object') return false;
    const node = value as Record<string, unknown>;
    if (
      typeof node.type === 'string' &&
      ['image', 'video', 'videoEmbed', 'table', 'codeBlock', 'horizontalRule'].includes(node.type)
    ) {
      return true;
    }
    if (typeof node.text === 'string' && node.text.trim()) return true;
    return hasMeaningfulNode(node.content);
  };

  return nodes.some(hasMeaningfulNode);
}

function validateDraftForPublish(
  draft: CourseVersionAuthorDetail,
  dirty: boolean,
  lifecycleStatus: string,
): PublishValidationIssue[] {
  const issues: PublishValidationIssue[] = [];
  if (draft.sections.length === 0) {
    issues.push({ severity: 'error', message: 'Добавьте хотя бы один раздел.' });
  }
  if (countLessons(draft) === 0) {
    issues.push({ severity: 'error', message: 'Добавьте хотя бы один урок.' });
  }
  if (dirty) {
    issues.push({
      severity: 'error',
      message: 'Сохраните изменения текущего урока перед публикацией.',
    });
  }
  if (lifecycleStatus === 'archived') {
    issues.push({
      severity: 'warning',
      message: 'Курс архивирован. После публикации его lifecycle определит backend.',
    });
  }

  draft.sections.forEach((section) => {
    if (!section.title.trim()) {
      issues.push({
        severity: 'error',
        sectionId: section.id,
        sectionTitle: 'Раздел без названия',
        message: 'Заполните название раздела.',
      });
    }
    if (section.lessons.length === 0) {
      issues.push({
        severity: 'warning',
        sectionId: section.id,
        sectionTitle: section.title,
        message: 'В разделе пока нет уроков.',
      });
    }

    section.lessons.forEach((lesson) => {
      const location = {
        sectionId: section.id,
        sectionTitle: section.title,
        lessonId: lesson.id,
        lessonTitle: lesson.title || 'Урок без названия',
      };
      if (!lesson.title.trim()) {
        issues.push({
          severity: 'error',
          ...location,
          message: 'Заполните название урока.',
        });
      }
      if (!hasLessonContent(lesson.content)) {
        issues.push({
          severity: 'error',
          ...location,
          message: 'Добавьте содержимое урока.',
        });
      }
      if (lesson.quiz) {
        validateQuiz(lesson.quiz).forEach((issue) => {
          issues.push({
            severity: issue.severity,
            ...location,
            message: issue.message,
          });
        });
      }
    });
  });
  return issues;
}

function parsePublishValidationDetails(details: unknown): PublishValidationIssue[] {
  if (!details || typeof details !== 'object') return [];
  const object = details as Record<string, unknown>;
  const parseGroup = (
    value: unknown,
    severity: PublishValidationIssue['severity'],
  ): PublishValidationIssue[] => {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
      if (typeof entry === 'string') return [{ severity, message: entry }];
      if (!entry || typeof entry !== 'object') return [];
      const issue = entry as Record<string, unknown>;
      const message =
        typeof issue.message === 'string'
          ? issue.message
          : typeof issue.code === 'string'
            ? issue.code
            : 'Проверка публикации не пройдена.';
      return [
        {
          severity,
          message,
          sectionId: typeof issue.sectionId === 'string' ? issue.sectionId : undefined,
          sectionTitle: typeof issue.sectionTitle === 'string' ? issue.sectionTitle : undefined,
          lessonId: typeof issue.lessonId === 'string' ? issue.lessonId : undefined,
          lessonTitle: typeof issue.lessonTitle === 'string' ? issue.lessonTitle : undefined,
        },
      ];
    });
  };
  return [
    ...parseGroup(object.errors, 'error'),
    ...parseGroup(object.warnings, 'warning'),
    ...(Array.isArray(object.issues)
      ? object.issues.flatMap((entry) => {
          if (!entry || typeof entry !== 'object') return [];
          const issue = entry as Record<string, unknown>;
          return parseGroup([issue], issue.severity === 'warning' ? 'warning' : 'error');
        })
      : []),
  ];
}

function moveLessonInDraft(
  draft: CourseVersionAuthorDetail,
  lessonId: string,
  targetSectionId: string,
  targetOrder: number,
): CourseVersionAuthorDetail {
  const sourceLesson = draft.sections
    .flatMap((section) => section.lessons)
    .find((lesson) => lesson.id === lessonId);
  if (!sourceLesson) return draft;

  const withoutLesson = draft.sections.map((section) => ({
    ...section,
    lessons: section.lessons.filter((lesson) => lesson.id !== lessonId),
  }));
  return {
    ...draft,
    sections: withoutLesson.map((section) => {
      const lessons = section.lessons.slice().sort((a, b) => a.order - b.order);
      if (section.id === targetSectionId) {
        lessons.splice(Math.max(0, Math.min(targetOrder, lessons.length)), 0, {
          ...sourceLesson,
          sectionId: targetSectionId,
        });
      }
      return {
        ...section,
        lessons: lessons.map((lesson, order) => ({ ...lesson, order })),
      };
    }),
  };
}

export function CourseBuilderPage() {
  const { courseId = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const selectedLessonId = searchParams.get('lesson');
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState<RichTextContent>({ type: 'doc', content: [] });
  const [quiz, setQuiz] = useState<QuizAuthor | null>(null);
  const [dirty, setDirty] = useState(false);
  const [renameLesson, setRenameLesson] = useState<{
    id: string;
    currentTitle: string;
    title: string;
  } | null>(null);
  const [serverPublishIssues, setServerPublishIssues] = useState<PublishValidationIssue[]>([]);
  const publishIdempotencyKey = useRef<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; text: string; run: () => void } | null>(
    null,
  );

  const navigationBlocker = useUnsavedChanges(dirty);

  const userQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: authApi.getCurrentUser,
  });
  const courseQuery = useQuery({
    queryKey: queryKeys.academyV2.course(courseId),
    queryFn: ({ signal }) => academyCoursesApi.get(courseId, { signal }),
    enabled: Boolean(courseId),
  });
  const draftQuery = useQuery({
    queryKey: queryKeys.academyV2.draft(courseId),
    queryFn: ({ signal }) => academyCoursesApi.getDraft(courseId, { signal }),
    enabled: Boolean(courseId && courseQuery.data?.draftVersion),
    retry: false,
  });

  const course = courseQuery.data;
  const draft = draftQuery.data;
  const caps = useMemo(() => {
    if (!course || !userQuery.data) return null;
    return resolveCourseCapabilities({
      role: userQuery.data.role,
      userId: userQuery.data.id,
      course,
    });
  }, [course, userQuery.data]);

  useTitle(course ? `${course.title} — конструктор — TeamOS` : 'Конструктор курса — TeamOS');

  const sections = useMemo(
    () => (draft?.sections ?? []).slice().sort((a, b) => a.order - b.order),
    [draft?.sections],
  );

  const selectedLesson: LessonAuthor | undefined = useMemo(() => {
    for (const section of sections) {
      const lesson = section.lessons.find((l) => l.id === selectedLessonId);
      if (lesson) return lesson;
    }
    return undefined;
  }, [sections, selectedLessonId]);

  useEffect(() => {
    const selectedExists = sections.some((section) =>
      section.lessons.some((lesson) => lesson.id === selectedLessonId),
    );
    if (selectedExists) return;
    const first = sections[0]?.lessons.slice().sort((a, b) => a.order - b.order)[0];
    if (first) {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set('lesson', first.id);
          return next;
        },
        { replace: true },
      );
    }
  }, [sections, selectedLessonId, setSearchParams]);

  const selectLesson = (lessonId: string | null, replace = false) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (lessonId) next.set('lesson', lessonId);
        else next.delete('lesson');
        return next;
      },
      { replace },
    );
    setOutlineOpen(false);
  };

  const requestSelectLesson = (lessonId: string) => {
    if (lessonId === selectedLessonId) {
      setOutlineOpen(false);
      return;
    }
    if (!dirty) {
      selectLesson(lessonId);
      return;
    }
    setConfirm({
      title: 'Перейти без сохранения?',
      text: 'Несохранённые изменения текущего урока будут потеряны.',
      run: () => selectLesson(lessonId),
    });
  };

  useEffect(() => {
    if (!selectedLesson) return;
    setTitle(selectedLesson.title);
    setContent(selectedLesson.content ?? { type: 'doc', content: [] });
    setQuiz(selectedLesson.quiz ?? null);
    setDirty(false);
    // Reset editor only when switching lessons, not on every draft refetch of same id.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: selectedLesson.id
  }, [selectedLesson?.id]);

  const invalidateDraft = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.draft(courseId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.course(courseId) });
  };

  const draftVersionId = draft?.id;

  const ensureDraft = useMutation({
    mutationFn: () => academyCoursesApi.ensureDraft(courseId),
    onSuccess: (createdDraft) => {
      queryClient.setQueryData(queryKeys.academyV2.draft(courseId), createdDraft);
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.course(courseId) });
      toast.success(`Создан черновик версии v${createdDraft.versionNumber}`);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Не удалось создать черновик'),
  });

  const createSection = useMutation({
    mutationFn: () => {
      if (!draftVersionId) throw new Error('no draft');
      return academyVersionsApi.createSection(draftVersionId, {
        title: `Раздел ${sections.length + 1}`,
      });
    },
    onSuccess: () => {
      invalidateDraft();
      toast.success('Раздел создан');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Не удалось создать раздел'),
  });

  const renameSection = useMutation({
    mutationFn: (input: { id: string; title: string }) =>
      academyVersionsApi.updateSection(input.id, { title: input.title }),
    onSuccess: invalidateDraft,
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Не удалось переименовать'),
  });

  const deleteSection = useMutation({
    mutationFn: (sectionId: string) => academyVersionsApi.deleteSection(sectionId),
    onSuccess: (_result, sectionId) => {
      if (selectedLesson?.sectionId === sectionId) selectLesson(null, true);
      toast.success('Раздел удалён');
      invalidateDraft();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Не удалось удалить раздел'),
  });

  const createLesson = useMutation({
    mutationFn: (sectionId: string) => {
      if (!draftVersionId) throw new Error('no draft');
      return academyVersionsApi.createLesson(draftVersionId, {
        sectionId,
        title: 'Новый урок',
      });
    },
    onSuccess: (lesson) => {
      selectLesson(lesson.id);
      invalidateDraft();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Не удалось создать урок'),
  });

  const deleteLesson = useMutation({
    mutationFn: (lessonId: string) => academyVersionsApi.deleteLesson(lessonId),
    onSuccess: (_result, lessonId) => {
      if (lessonId === selectedLessonId) selectLesson(null, true);
      toast.success('Урок удалён');
      invalidateDraft();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Не удалось удалить урок'),
  });

  const renameLessonMutation = useMutation({
    mutationFn: (input: { id: string; title: string }) =>
      academyVersionsApi.updateLesson(input.id, { title: input.title }),
    onSuccess: (updated) => {
      if (updated.id === selectedLessonId && !dirty) setTitle(updated.title);
      setRenameLesson(null);
      invalidateDraft();
      toast.success('Урок переименован');
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : 'Не удалось переименовать урок'),
  });

  const moveLesson = useMutation({
    mutationFn: (input: { id: string; sectionId: string; order: number }) =>
      academyVersionsApi.moveLesson(input.id, {
        sectionId: input.sectionId,
        order: input.order,
      }),
    onMutate: async (input) => {
      const key = queryKeys.academyV2.draft(courseId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CourseVersionAuthorDetail>(key);
      if (previous) {
        queryClient.setQueryData(
          key,
          moveLessonInDraft(previous, input.id, input.sectionId, input.order),
        );
      }
      return { previous };
    },
    onSuccess: invalidateDraft,
    onError: (e, input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.academyV2.draft(courseId), context.previous);
      } else if (input.id) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.draft(courseId) });
      }
      toast.error(e instanceof ApiError ? e.message : 'Не удалось переместить');
    },
  });

  const saveLesson = useMutation({
    mutationFn: async () => {
      if (!selectedLesson) throw new Error('no lesson');
      if (quiz) {
        const quizErrors = validateQuiz(quiz).filter((issue) => issue.severity === 'error');
        if (quizErrors.length > 0) {
          throw new ApiError(quizErrors[0]?.message ?? 'Исправьте ошибки теста.', 422, {
            code: 'QUIZ_VALIDATION_FAILED',
            details: { issues: quizErrors },
          });
        }
      }
      const updated = await academyVersionsApi.updateLesson(selectedLesson.id, {
        title: title.trim() || selectedLesson.title,
        content,
      });
      if (quiz) {
        await academyVersionsApi.upsertQuiz(selectedLesson.id, {
          questions: quiz.questions.map((question) => ({
            ...question,
            required: question.required ?? true,
          })),
          passingScore: quiz.passingScore,
          // Explicit null clears an existing limit; JSON would omit undefined.
          maxAttempts: quiz.maxAttempts ?? null,
        });
      } else if (selectedLesson.quiz) {
        await academyVersionsApi.deleteQuiz(selectedLesson.id);
      }
      return updated;
    },
    onSuccess: () => {
      setDirty(false);
      toast.success('Урок сохранён');
      invalidateDraft();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Не удалось сохранить урок'),
  });

  const publish = useMutation({
    mutationFn: (idempotencyKey: string) =>
      academyVersionsApi.publish(courseId, { idempotencyKey }),
    onSuccess: (result) => {
      publishIdempotencyKey.current = null;
      setServerPublishIssues([]);
      setPublishOpen(false);
      toast.success(`Опубликована версия v${result.version.versionNumber}`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.course(courseId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.versions(courseId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.draft(courseId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.coursesRoot });
    },
    onError: (e) => {
      const err = e instanceof ApiError ? e : null;
      const details = parsePublishValidationDetails(err?.details);
      setServerPublishIssues(
        details.length > 0
          ? details
          : err?.code === 'PUBLISH_VALIDATION_FAILED'
            ? [
                {
                  severity: 'error',
                  message: err?.message ?? 'Не удалось опубликовать версию.',
                },
              ]
            : [],
      );
      toast.error(
        err?.code === 'PUBLISH_VALIDATION_FAILED'
          ? err.message
          : (err?.message ?? 'Не удалось опубликовать'),
      );
    },
  });

  const draftMissing =
    !draft &&
    (Boolean(course && !course.draftVersion) ||
      (draftQuery.error instanceof ApiError && draftQuery.error.status === 404));
  const publishIssues = useMemo(() => {
    if (!draft || !course) return serverPublishIssues;
    return [
      ...validateDraftForPublish(draft, dirty, course.lifecycleStatus),
      ...serverPublishIssues,
    ];
  }, [course, dirty, draft, serverPublishIssues]);

  const openPublishDialog = () => {
    publishIdempotencyKey.current = createId();
    setServerPublishIssues([]);
    setPublishOpen(true);
  };

  const closePublishDialog = () => {
    if (publish.isPending) return;
    publishIdempotencyKey.current = null;
    setServerPublishIssues([]);
    setPublishOpen(false);
  };

  if (courseQuery.isError || (draftQuery.isError && !draftMissing)) {
    const status =
      courseQuery.error instanceof ApiError
        ? courseQuery.error.status
        : draftQuery.error instanceof ApiError
          ? draftQuery.error.status
          : 0;
    if (status === 403) {
      return (
        <div className="mx-auto max-w-lg p-8">
          <EmptyState
            icon={Settings2}
            title="Недостаточно прав"
            description="Редактировать draft могут только авторы с capability canEditDraft."
            action={
              <Link to={academyRoutes.course(courseId)}>
                <Button variant="secondary">К курсу</Button>
              </Link>
            }
          />
        </div>
      );
    }
    return (
      <div className="p-6">
        <ErrorState
          onRetry={() => {
            void courseQuery.refetch();
            void draftQuery.refetch();
          }}
        />
      </div>
    );
  }

  if (courseQuery.isLoading || userQuery.isLoading || draftQuery.isLoading || !course) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Загружаем конструктор…
      </div>
    );
  }

  if (caps && !caps.canEditDraft) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <EmptyState
          icon={Settings2}
          title="Черновик недоступен"
          description="Нет права редактировать draft этого курса."
          action={
            <Link to={academyRoutes.course(course.id)}>
              <Button variant="secondary">К курсу</Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (draftMissing || !draft) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page p-6">
        <EmptyState
          icon={FolderPlus}
          title="У курса нет черновика"
          description="Опубликованная версия остаётся неизменяемой. Создайте новый черновик, чтобы подготовить следующую версию."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button loading={ensureDraft.isPending} onClick={() => ensureDraft.mutate()}>
                Создать черновик новой версии
              </Button>
              <Link to={academyRoutes.course(course.id)}>
                <Button variant="secondary">К курсу</Button>
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  const lessonCount = countLessons(draft);
  const lifecyclePresentation = {
    active: { label: 'Активен', variant: 'success' as const },
    archived: { label: 'В архиве', variant: 'warning' as const },
    deleted: { label: 'Удалён', variant: 'danger' as const },
  }[course.lifecycleStatus];

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <Link
            to={academyRoutes.course(courseId)}
            onClick={(event) => {
              if (!dirty) return;
              event.preventDefault();
              navigationBlocker.request(() => navigate(academyRoutes.course(courseId)));
            }}
            className="mb-0.5 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary-600"
          >
            <ChevronLeft className="size-4" />К курсу
          </Link>
          <h1 className="truncate text-base font-semibold text-slate-950 sm:text-lg">
            {course.title}
            <span className="ml-2 text-sm font-normal text-slate-500">
              · черновик
              {draft.versionNumber ? ` v${draft.versionNumber}` : ''}
            </span>
            <Badge variant={lifecyclePresentation.variant} className="ml-2 align-middle">
              {lifecyclePresentation.label}
            </Badge>
          </h1>
          <p className="text-xs text-slate-500">
            {sections.length} {plural(sections.length, ['раздел', 'раздела', 'разделов'])} ·{' '}
            {lessonCount} {plural(lessonCount, ['урок', 'урока', 'уроков'])}
            {dirty ? ' · есть несохранённые изменения' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="lg:hidden"
            onClick={() => setOutlineOpen(true)}
          >
            <ListPlus className="size-4" />
            Структура
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="size-4" />
            Настройки
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!draft}
            onClick={() =>
              navigationBlocker.request(() => navigate(academyRoutes.previewDraft(draft.id)))
            }
          >
            <Eye className="size-4" />
            Предпросмотр
          </Button>
          <Button
            size="sm"
            disabled={!caps?.canPublish && caps !== null}
            onClick={openPublishDialog}
          >
            Опубликовать
          </Button>
        </div>
      </header>

      <div className="grid flex-1 lg:grid-cols-[minmax(280px,340px)_1fr]">
        <aside className="hidden space-y-3 border-r border-slate-200 bg-surface p-3 lg:block">
          <BuilderOutline
            sections={sections}
            selectedLessonId={selectedLessonId}
            dirty={dirty}
            moving={moveLesson.isPending}
            creatingLesson={createLesson.isPending}
            creatingSection={createSection.isPending}
            onSelectLesson={requestSelectLesson}
            onCreateSection={() => createSection.mutate()}
            onCreateLesson={(sectionId) => createLesson.mutate(sectionId)}
            onRenameSection={(id, nextTitle) => renameSection.mutate({ id, title: nextTitle })}
            onDeleteSection={(sectionId, sectionTitle, lessonCountInSection) =>
              setConfirm({
                title: 'Удалить раздел?',
                text: `Раздел «${sectionTitle}» будет удалён вместе с уроками (${lessonCountInSection}).`,
                run: () => deleteSection.mutate(sectionId),
              })
            }
            onRenameLesson={(lesson) =>
              setRenameLesson({ id: lesson.id, currentTitle: lesson.title, title: lesson.title })
            }
            onDeleteLesson={(lesson) =>
              setConfirm({
                title: 'Удалить урок?',
                text: `Урок «${lesson.title}» будет удалён из черновика.`,
                run: () => deleteLesson.mutate(lesson.id),
              })
            }
            onMoveLesson={(id, sectionId, order) => moveLesson.mutate({ id, sectionId, order })}
          />
        </aside>

        <main className="overflow-y-auto p-4 sm:p-6">
          {selectedLesson ? (
            <div className="mx-auto max-w-3xl space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <Input
                  label="Название урока"
                  className="min-w-[16rem] flex-1"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setDirty(true);
                  }}
                />
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setConfirm({
                        title: 'Удалить урок?',
                        text: `Урок «${selectedLesson.title}» будет удалён из черновика.`,
                        run: () => deleteLesson.mutate(selectedLesson.id),
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                    Удалить
                  </Button>
                  <Button
                    size="sm"
                    loading={saveLesson.isPending}
                    disabled={!dirty}
                    onClick={() => saveLesson.mutate()}
                  >
                    <Save className="size-4" />
                    Сохранить
                  </Button>
                </div>
              </div>

              <RichTextEditor
                value={content}
                onChange={(next) => {
                  setContent(next);
                  setDirty(true);
                }}
              />

              {quiz ? (
                <QuizEditor
                  quiz={quiz}
                  onChange={(next) => {
                    setQuiz(next);
                    setDirty(true);
                  }}
                  onRemove={() => {
                    setQuiz(null);
                    setDirty(true);
                  }}
                />
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setQuiz(createEmptyQuiz(selectedLesson.id));
                    setDirty(true);
                  }}
                >
                  Добавить тест
                </Button>
              )}
            </div>
          ) : (
            <EmptyState
              icon={ListPlus}
              title="Выберите урок"
              description="Создайте раздел и урок слева, затем наполните содержимое справа."
            />
          )}
        </main>
      </div>

      <Drawer open={outlineOpen} onOpenChange={setOutlineOpen} title="Структура курса" size="md">
        <BuilderOutline
          sections={sections}
          selectedLessonId={selectedLessonId}
          dirty={dirty}
          moving={moveLesson.isPending}
          creatingLesson={createLesson.isPending}
          creatingSection={createSection.isPending}
          onSelectLesson={requestSelectLesson}
          onCreateSection={() => createSection.mutate()}
          onCreateLesson={(sectionId) => createLesson.mutate(sectionId)}
          onRenameSection={(id, nextTitle) => renameSection.mutate({ id, title: nextTitle })}
          onDeleteSection={(sectionId, sectionTitle, lessonCountInSection) =>
            setConfirm({
              title: 'Удалить раздел?',
              text: `Раздел «${sectionTitle}» будет удалён вместе с уроками (${lessonCountInSection}).`,
              run: () => deleteSection.mutate(sectionId),
            })
          }
          onRenameLesson={(lesson) =>
            setRenameLesson({ id: lesson.id, currentTitle: lesson.title, title: lesson.title })
          }
          onDeleteLesson={(lesson) =>
            setConfirm({
              title: 'Удалить урок?',
              text: `Урок «${lesson.title}» будет удалён из черновика.`,
              run: () => deleteLesson.mutate(lesson.id),
            })
          }
          onMoveLesson={(id, sectionId, order) => moveLesson.mutate({ id, sectionId, order })}
        />
      </Drawer>

      <CourseSettingsDrawer
        course={course}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      <PublishDialog
        open={publishOpen}
        onClose={closePublishDialog}
        onConfirm={() => {
          const key = publishIdempotencyKey.current ?? createId();
          publishIdempotencyKey.current = key;
          publish.mutate(key);
        }}
        loading={publish.isPending}
        lessonCount={lessonCount}
        sectionCount={sections.length}
        issues={publishIssues}
        onNavigateToIssue={(issue) => {
          closePublishDialog();
          if (issue.lessonId) {
            requestSelectLesson(issue.lessonId);
            return;
          }
          if (issue.sectionId) {
            window.requestAnimationFrame(() => {
              Array.from(document.querySelectorAll<HTMLElement>('[data-builder-section]'))
                .find((element) => element.dataset.builderSection === issue.sectionId)
                ?.querySelector<HTMLElement>('input')
                ?.focus();
            });
          }
        }}
      />

      <Modal
        open={Boolean(renameLesson)}
        onOpenChange={(next) => !next && setRenameLesson(null)}
        title="Переименовать урок"
      >
        <div className="space-y-4">
          <Input
            label="Название урока"
            autoFocus
            value={renameLesson?.title ?? ''}
            onChange={(event) =>
              setRenameLesson((current) =>
                current ? { ...current, title: event.target.value } : current,
              )
            }
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                renameLesson?.title.trim() &&
                renameLesson.title.trim() !== renameLesson.currentTitle
              ) {
                renameLessonMutation.mutate({
                  id: renameLesson.id,
                  title: renameLesson.title.trim(),
                });
              }
            }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRenameLesson(null)}>
              Отмена
            </Button>
            <Button
              loading={renameLessonMutation.isPending}
              disabled={
                !renameLesson?.title.trim() ||
                renameLesson.title.trim() === renameLesson.currentTitle
              }
              onClick={() => {
                if (!renameLesson) return;
                renameLessonMutation.mutate({
                  id: renameLesson.id,
                  title: renameLesson.title.trim(),
                });
              }}
            >
              Сохранить
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={navigationBlocker.blocked}
        onOpenChange={(next) => !next && navigationBlocker.stay()}
        title="Уйти без сохранения?"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Несохранённые изменения текущего урока будут потеряны.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={navigationBlocker.stay}>
              Остаться
            </Button>
            <Button variant="danger" onClick={navigationBlocker.proceed}>
              Уйти без сохранения
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(confirm)}
        onOpenChange={(next) => !next && setConfirm(null)}
        title={confirm?.title ?? ''}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">{confirm?.text}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Отмена
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                confirm?.run();
                setConfirm(null);
              }}
            >
              Подтвердить
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

type BuilderSection = CourseVersionAuthorDetail['sections'][number];

interface BuilderOutlineProps {
  sections: BuilderSection[];
  selectedLessonId: string | null;
  dirty: boolean;
  moving: boolean;
  creatingLesson: boolean;
  creatingSection: boolean;
  onSelectLesson: (lessonId: string) => void;
  onCreateSection: () => void;
  onCreateLesson: (sectionId: string) => void;
  onRenameSection: (sectionId: string, title: string) => void;
  onDeleteSection: (sectionId: string, title: string, lessonCount: number) => void;
  onRenameLesson: (lesson: LessonAuthor) => void;
  onDeleteLesson: (lesson: LessonAuthor) => void;
  onMoveLesson: (lessonId: string, sectionId: string, order: number) => void;
}

function BuilderOutline({
  sections,
  selectedLessonId,
  dirty,
  moving,
  creatingLesson,
  creatingSection,
  onSelectLesson,
  onCreateSection,
  onCreateLesson,
  onRenameSection,
  onDeleteSection,
  onRenameLesson,
  onDeleteLesson,
  onMoveLesson,
}: BuilderOutlineProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const lessonId = String(active.id);
    const targetSectionId = String(over.data.current?.sectionId ?? '');
    if (!targetSectionId) return;
    const targetSection = sections.find((section) => section.id === targetSectionId);
    if (!targetSection) return;
    const ordered = targetSection.lessons.slice().sort((a, b) => a.order - b.order);
    const targetIndex = ordered.findIndex((lesson) => lesson.id === String(over.id));
    onMoveLesson(lessonId, targetSectionId, targetIndex < 0 ? ordered.length : targetIndex);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="rounded-xl border border-slate-200 p-2">
        {sections.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-slate-500">
            Добавьте первый раздел — уроки создаются внутри него.
          </p>
        ) : (
          <ul className="space-y-3">
            {sections.map((section) => (
              <BuilderSectionOutline
                key={section.id}
                section={section}
                sections={sections}
                selectedLessonId={selectedLessonId}
                dirty={dirty}
                moving={moving}
                creatingLesson={creatingLesson}
                onSelectLesson={onSelectLesson}
                onCreateLesson={onCreateLesson}
                onRenameSection={onRenameSection}
                onDeleteSection={onDeleteSection}
                onRenameLesson={onRenameLesson}
                onDeleteLesson={onDeleteLesson}
                onMoveLesson={onMoveLesson}
              />
            ))}
          </ul>
        )}
      </div>
      <Button
        variant="secondary"
        className="mt-3 w-full"
        loading={creatingSection}
        onClick={onCreateSection}
      >
        <FolderPlus className="size-4" />
        Добавить раздел
      </Button>
    </DndContext>
  );
}

function BuilderSectionOutline({
  section,
  sections,
  selectedLessonId,
  dirty,
  moving,
  creatingLesson,
  onSelectLesson,
  onCreateLesson,
  onRenameSection,
  onDeleteSection,
  onRenameLesson,
  onDeleteLesson,
  onMoveLesson,
}: Omit<BuilderOutlineProps, 'creatingSection' | 'onCreateSection'> & {
  section: BuilderSection;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const { setNodeRef, isOver } = useDroppable({
    id: `section-${section.id}`,
    data: { sectionId: section.id },
  });
  const lessons = section.lessons.slice().sort((a, b) => a.order - b.order);

  return (
    <li
      ref={setNodeRef}
      data-builder-section={section.id}
      className={cn(
        'rounded-lg border bg-slate-50/80 p-2 transition-colors',
        isOver ? 'border-primary-300 bg-primary-50/60' : 'border-slate-100',
      )}
    >
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          aria-label={
            collapsed
              ? `Развернуть раздел «${section.title}»`
              : `Свернуть раздел «${section.title}»`
          }
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
        </Button>
        <Input
          className="flex-1 bg-white"
          aria-label="Название раздела"
          defaultValue={section.title}
          key={`${section.id}-${section.title}`}
          onBlur={(event) => {
            const next = event.target.value.trim();
            if (next && next !== section.title) onRenameSection(section.id, next);
            else event.target.value = section.title;
          }}
        />
        <Button
          size="sm"
          variant="ghost"
          disabled={dirty}
          aria-label={`Удалить раздел «${section.title}»`}
          onClick={() => onDeleteSection(section.id, section.title, lessons.length)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      {!collapsed ? (
        <SortableContext
          items={lessons.map((lesson) => lesson.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="mt-2 space-y-1">
            {lessons.map((lesson, index) => (
              <SortableLessonRow
                key={lesson.id}
                lesson={lesson}
                section={section}
                sections={sections}
                index={index}
                selected={lesson.id === selectedLessonId}
                dirty={dirty}
                moving={moving}
                onSelectLesson={onSelectLesson}
                onRenameLesson={onRenameLesson}
                onDeleteLesson={onDeleteLesson}
                onMoveLesson={onMoveLesson}
              />
            ))}
            <li>
              <Button
                size="sm"
                variant="ghost"
                className="w-full justify-start"
                loading={creatingLesson}
                onClick={() => onCreateLesson(section.id)}
              >
                <ListPlus className="size-4" />
                Добавить урок
              </Button>
            </li>
          </ul>
        </SortableContext>
      ) : (
        <p className="px-2 pt-1 text-xs text-slate-500">
          {lessons.length} {plural(lessons.length, ['урок', 'урока', 'уроков'])}
        </p>
      )}
    </li>
  );
}

function SortableLessonRow({
  lesson,
  section,
  sections,
  index,
  selected,
  dirty,
  moving,
  onSelectLesson,
  onRenameLesson,
  onDeleteLesson,
  onMoveLesson,
}: {
  lesson: LessonAuthor;
  section: BuilderSection;
  sections: BuilderSection[];
  index: number;
  selected: boolean;
  dirty: boolean;
  moving: boolean;
  onSelectLesson: (lessonId: string) => void;
  onRenameLesson: (lesson: LessonAuthor) => void;
  onDeleteLesson: (lesson: LessonAuthor) => void;
  onMoveLesson: (lessonId: string, sectionId: string, order: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lesson.id,
    data: { sectionId: section.id },
  });
  const sectionLessons = section.lessons.slice().sort((a, b) => a.order - b.order);
  const focusLessonAfterMove = () => {
    window.requestAnimationFrame(() => {
      Array.from(document.querySelectorAll<HTMLElement>('[data-outline-lesson]'))
        .find((element) => element.dataset.outlineLesson === lesson.id)
        ?.focus();
    });
  };
  const moveWithFocus = (sectionId: string, order: number) => {
    onMoveLesson(lesson.id, sectionId, order);
    focusLessonAfterMove();
  };
  const moveItems: Array<DropdownItem | 'separator'> = [
    {
      key: 'up',
      label: 'Выше',
      icon: ChevronUp,
      disabled: moving || index === 0,
      onSelect: () => moveWithFocus(section.id, index - 1),
    },
    {
      key: 'down',
      label: 'Ниже',
      icon: ChevronDown,
      disabled: moving || index === sectionLessons.length - 1,
      onSelect: () => moveWithFocus(section.id, index + 1),
    },
    'separator',
    ...sections
      .filter((target) => target.id !== section.id)
      .map((target): DropdownItem => ({
        key: `section-${target.id}`,
        label: `В раздел «${target.title}»`,
        disabled: moving,
        onSelect: () => moveWithFocus(target.id, target.lessons.length),
      })),
    'separator',
    {
      key: 'rename',
      label: 'Переименовать',
      icon: Pencil,
      disabled: selected && dirty,
      onSelect: () => onRenameLesson(lesson),
    },
    {
      key: 'delete',
      label: 'Удалить',
      icon: Trash2,
      danger: true,
      disabled: selected && dirty,
      onSelect: () => onDeleteLesson(lesson),
    },
  ];
  const hasValidationError =
    !lesson.title.trim() ||
    !hasLessonContent(lesson.content) ||
    Boolean(lesson.quiz && validateQuiz(lesson.quiz).some((issue) => issue.severity === 'error'));

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex items-center gap-0.5', isDragging && 'opacity-50')}
    >
      <button
        type="button"
        className="touch-none rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        aria-label={`Перетащить урок «${lesson.title}»`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <button
        type="button"
        data-outline-lesson={lesson.id}
        onClick={() => onSelectLesson(lesson.id)}
        className={cn(
          'min-w-0 flex-1 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors',
          selected
            ? 'bg-primary-600 font-medium text-white shadow-sm'
            : 'bg-white text-slate-700 hover:bg-primary-50',
        )}
      >
        <span className="line-clamp-2">{lesson.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          {!hasLessonContent(lesson.content) ? (
            <span title="Пустой контент" className={selected ? 'text-white/80' : 'text-slate-400'}>
              <CircleDot className="size-3.5" aria-hidden="true" />
              <span className="sr-only">Пустой контент</span>
            </span>
          ) : null}
          {lesson.quiz ? (
            <span title="Есть тест" className={selected ? 'text-white/90' : 'text-primary-600'}>
              <CircleDot className="size-3.5 fill-current" aria-hidden="true" />
              <span className="sr-only">Есть тест</span>
            </span>
          ) : null}
          {lesson.sourceArticleId ? (
            <span
              title="Источник — база знаний"
              className={selected ? 'text-white/90' : 'text-sky-600'}
            >
              <Link2 className="size-3.5" aria-hidden="true" />
              <span className="sr-only">Источник — база знаний</span>
            </span>
          ) : null}
          {hasValidationError ? (
            <span
              title="Есть ошибка валидации"
              className={selected ? 'text-white' : 'text-danger-600'}
            >
              <CircleAlert className="size-3.5" aria-hidden="true" />
              <span className="sr-only">Есть ошибка валидации</span>
            </span>
          ) : null}
          {selected && dirty ? (
            <span title="Есть несохранённые изменения" className="text-white">
              <Save className="size-3.5" aria-hidden="true" />
              <span className="sr-only">Есть несохранённые изменения</span>
            </span>
          ) : null}
        </span>
      </button>
      <Dropdown
        trigger={
          <Button size="sm" variant="ghost" aria-label={`Переместить урок «${lesson.title}»`}>
            <MoreHorizontal className="size-4" />
          </Button>
        }
        items={moveItems}
      />
    </li>
  );
}
