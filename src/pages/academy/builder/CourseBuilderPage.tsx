import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Eye,
  FolderPlus,
  ListPlus,
  Save,
  Settings2,
  Trash2,
} from 'lucide-react';
import { academyCoursesApi, academyVersionsApi } from '@/api/academy';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import {
  Button,
  Input,
  Modal,
  RichTextEditor,
} from '@/components/ui';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { academyRoutes, resolveCourseCapabilities } from '@/lib/academy';
import { cn } from '@/lib/cn';
import { plural } from '@/lib/format';
import { toast } from '@/stores/toast';
import type { RichTextContent } from '@/types';
import type {
  CourseVersionAuthorDetail,
  LessonAuthor,
  QuizAuthor,
} from '@/types/academy';
import { authApi } from '@/api';
import { CourseSettingsDrawer } from './CourseSettingsDrawer';
import { PublishDialog } from './PublishDialog';
import { QuizEditor, createEmptyQuiz } from './QuizEditor';
import { useUnsavedChanges } from './useUnsavedChanges';

function countLessons(draft: CourseVersionAuthorDetail | undefined): number {
  return draft?.sections.reduce((sum, s) => sum + s.lessons.length, 0) ?? 0;
}

export function CourseBuilderPage() {
  const { courseId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState<RichTextContent>({ type: 'doc', content: [] });
  const [quiz, setQuiz] = useState<QuizAuthor | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; text: string; run: () => void } | null>(
    null,
  );

  useUnsavedChanges(dirty);

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
    enabled: Boolean(courseId),
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
    if (selectedLessonId) return;
    const first = sections[0]?.lessons.slice().sort((a, b) => a.order - b.order)[0];
    if (first) setSelectedLessonId(first.id);
  }, [sections, selectedLessonId]);

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

  const createSection = useMutation({
    mutationFn: () =>
      academyVersionsApi.createSection(courseId, {
        title: `Раздел ${sections.length + 1}`,
      }),
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
    onSuccess: () => {
      toast.success('Раздел удалён');
      invalidateDraft();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Не удалось удалить раздел'),
  });

  const createLesson = useMutation({
    mutationFn: (sectionId: string) =>
      academyVersionsApi.createLesson(courseId, {
        sectionId,
        title: 'Новый урок',
      }),
    onSuccess: (lesson) => {
      setSelectedLessonId(lesson.id);
      invalidateDraft();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Не удалось создать урок'),
  });

  const deleteLesson = useMutation({
    mutationFn: (lessonId: string) => academyVersionsApi.deleteLesson(lessonId),
    onSuccess: () => {
      setSelectedLessonId(null);
      toast.success('Урок удалён');
      invalidateDraft();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Не удалось удалить урок'),
  });

  const moveLesson = useMutation({
    mutationFn: (input: { id: string; sectionId: string; order: number }) =>
      academyVersionsApi.moveLesson(input.id, {
        sectionId: input.sectionId,
        order: input.order,
      }),
    onSuccess: invalidateDraft,
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Не удалось переместить'),
  });

  const saveLesson = useMutation({
    mutationFn: async () => {
      if (!selectedLesson) throw new Error('no lesson');
      const updated = await academyVersionsApi.updateLesson(selectedLesson.id, {
        title: title.trim() || selectedLesson.title,
        content,
      });
      if (quiz) {
        await academyVersionsApi.upsertQuiz({ ...quiz, lessonId: selectedLesson.id });
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
    mutationFn: () => academyVersionsApi.publish(courseId, { idempotencyKey: crypto.randomUUID() }),
    onSuccess: (result) => {
      setPublishOpen(false);
      toast.success(`Опубликована версия v${result.version.versionNumber}`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.course(courseId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.versions(courseId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.draft(courseId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.courses() });
    },
    onError: (e) => {
      const err = e instanceof ApiError ? e : null;
      toast.error(
        err?.code === 'PUBLISH_VALIDATION_FAILED'
          ? err.message
          : err?.message ?? 'Не удалось опубликовать',
      );
    },
  });

  if (courseQuery.isError || draftQuery.isError) {
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

  if (courseQuery.isLoading || draftQuery.isLoading || !course || !draft) {
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

  const lessonCount = countLessons(draft);
  const validationMessage =
    lessonCount === 0 ? 'Добавьте хотя бы один урок перед публикацией.' : undefined;

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <Link
            to={academyRoutes.course(courseId)}
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
          </h1>
          <p className="text-xs text-slate-500">
            {sections.length} {plural(sections.length, ['раздел', 'раздела', 'разделов'])} ·{' '}
            {lessonCount} {plural(lessonCount, ['урок', 'урока', 'уроков'])}
            {dirty ? ' · есть несохранённые изменения' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="size-4" />
            Настройки
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!course.draftVersion}
            onClick={() =>
              navigate(
                course.draftVersion
                  ? academyRoutes.previewDraft(course.draftVersion.id)
                  : academyRoutes.course(courseId),
              )
            }
          >
            <Eye className="size-4" />
            Предпросмотр
          </Button>
          <Button
            size="sm"
            disabled={!caps?.canPublish && caps !== null}
            onClick={() => setPublishOpen(true)}
          >
            Опубликовать
          </Button>
        </div>
      </header>

      <div className="grid flex-1 lg:grid-cols-[minmax(280px,340px)_1fr]">
        <aside className="space-y-3 border-r border-slate-200 bg-surface p-3">
          <div className="rounded-xl border border-slate-200 p-2">
            {sections.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-slate-500">
                Добавьте первый раздел — уроки создаются внутри него.
              </p>
            ) : (
              <ul className="space-y-3">
                {sections.map((section) => {
                  const sectionLessons = section.lessons.slice().sort((a, b) => a.order - b.order);
                  return (
                    <li key={section.id} className="rounded-lg border border-slate-100 bg-slate-50/80 p-2">
                      <div className="flex items-center gap-1">
                        <Input
                          className="flex-1 bg-white"
                          aria-label="Название раздела"
                          defaultValue={section.title}
                          key={`${section.id}-${section.title}`}
                          onBlur={(event) => {
                            const next = event.target.value.trim();
                            if (next && next !== section.title) {
                              renameSection.mutate({ id: section.id, title: next });
                            } else {
                              event.target.value = section.title;
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Удалить раздел «${section.title}»`}
                          onClick={() =>
                            setConfirm({
                              title: 'Удалить раздел?',
                              text: `Раздел «${section.title}» будет удалён вместе с уроками (${sectionLessons.length}).`,
                              run: () => deleteSection.mutate(section.id),
                            })
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                      <ul className="mt-2 space-y-1">
                        {sectionLessons.map((lesson, index) => (
                          <li key={lesson.id} className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                if (dirty && !window.confirm('Есть несохранённые изменения. Перейти?')) {
                                  return;
                                }
                                setSelectedLessonId(lesson.id);
                              }}
                              className={cn(
                                'min-w-0 flex-1 truncate rounded-md px-2.5 py-1.5 text-left text-sm transition-colors',
                                lesson.id === selectedLessonId
                                  ? 'bg-primary-600 font-medium text-white shadow-sm'
                                  : 'bg-white text-slate-700 hover:bg-primary-50',
                              )}
                            >
                              {lesson.title}
                            </button>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label="Выше"
                              disabled={index === 0 || moveLesson.isPending}
                              onClick={() =>
                                moveLesson.mutate({
                                  id: lesson.id,
                                  sectionId: section.id,
                                  order: index - 1,
                                })
                              }
                            >
                              <ChevronUp className="size-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label="Ниже"
                              disabled={
                                index === sectionLessons.length - 1 || moveLesson.isPending
                              }
                              onClick={() =>
                                moveLesson.mutate({
                                  id: lesson.id,
                                  sectionId: section.id,
                                  order: index + 1,
                                })
                              }
                            >
                              <ChevronDown className="size-4" />
                            </Button>
                          </li>
                        ))}
                        <li>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="w-full justify-start"
                            loading={createLesson.isPending}
                            onClick={() => createLesson.mutate(section.id)}
                          >
                            <ListPlus className="size-4" />
                            Добавить урок
                          </Button>
                        </li>
                      </ul>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <Button
            variant="secondary"
            className="w-full"
            loading={createSection.isPending}
            onClick={() => createSection.mutate()}
          >
            <FolderPlus className="size-4" />
            Добавить раздел
          </Button>
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

      <CourseSettingsDrawer
        course={course}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      <PublishDialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        onConfirm={() => publish.mutate()}
        loading={publish.isPending}
        lessonCount={lessonCount}
        sectionCount={sections.length}
        validationMessage={validationMessage}
      />

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
