import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { ArrowDown, ArrowUp, FileStack, Plus, Trash2 } from 'lucide-react';
import { academyTemplatesApi } from '@/api/academy';
import type {
  TemplateDraftLessonInput,
  TemplateDraftSectionInput,
  TemplateVersionDetail,
} from '@/api/academy/templates';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { Button, Input, RichTextEditor, Textarea } from '@/components/ui';
import { QuizEditor, validateQuiz } from '@/pages/academy/builder/QuizEditor';
import { academyRoutes } from '@/lib/academy';
import { createId } from '@/lib/id';
import { toast } from '@/stores/toast';
import type { QuizAuthor } from '@/types/academy';
import type { RichTextContent } from '@/types';

type EditableLesson = Omit<TemplateDraftLessonInput, 'quiz'> & {
  quiz?: QuizAuthor;
};

type EditableSection = Omit<TemplateDraftSectionInput, 'lessons'> & {
  lessons: EditableLesson[];
};

const EMPTY_DOCUMENT: RichTextContent = { type: 'doc', content: [] };

function editableSections(version: TemplateVersionDetail): EditableSection[] {
  const content = version.content;
  const quizByLesson = new Map(
    (content.quizzes ?? []).map((quiz) => [
      quiz.lessonVersionId,
      {
        id: quiz.id,
        lessonId: quiz.lessonVersionId,
        questions: quiz.questions,
        passingScore: quiz.passingScore,
        maxAttempts: quiz.maxAttempts,
      } satisfies QuizAuthor,
    ]),
  );
  return [...(content.sections ?? [])]
    .sort((left, right) => left.order - right.order)
    .map((section, sectionIndex) => ({
      stableKey: section.stableKey,
      title: section.title,
      order: sectionIndex,
      lessons: (content.lessons ?? [])
        .filter((lesson) => lesson.sectionVersionId === section.id)
        .sort((left, right) => left.order - right.order)
        .map((lesson, lessonIndex) => ({
          stableKey: lesson.stableKey,
          title: lesson.title,
          order: lessonIndex,
          content: lesson.content,
          sourceType: lesson.sourceType,
          sourceArticleId: lesson.sourceArticleId,
          sourceArticleVersion: lesson.sourceArticleVersion,
          estimatedMinutes: lesson.estimatedMinutes,
          quiz: quizByLesson.get(lesson.id),
        })),
    }));
}

function reorder<T>(items: T[], currentIndex: number, targetIndex: number): T[] {
  if (targetIndex < 0 || targetIndex >= items.length) return items;
  const next = items.slice();
  const [item] = next.splice(currentIndex, 1);
  if (!item) return items;
  next.splice(targetIndex, 0, item);
  return next;
}

function apiSections(sections: EditableSection[]): TemplateDraftSectionInput[] {
  return sections.map((section, sectionIndex) => ({
    stableKey: section.stableKey,
    title: section.title.trim(),
    order: sectionIndex,
    lessons: section.lessons.map((lesson, lessonIndex) => ({
      stableKey: lesson.stableKey,
      title: lesson.title.trim(),
      order: lessonIndex,
      content: lesson.content,
      sourceType: lesson.sourceType ?? 'manual',
      sourceArticleId: lesson.sourceArticleId,
      sourceArticleVersion: lesson.sourceArticleVersion,
      estimatedMinutes: lesson.estimatedMinutes,
      quiz: lesson.quiz
        ? {
            questions: lesson.quiz.questions,
            passingScore: lesson.quiz.passingScore,
            maxAttempts: lesson.quiz.maxAttempts,
          }
        : undefined,
    })),
  }));
}

export function TemplateBuilderPage() {
  const { templateId = '' } = useParams();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sequential, setSequential] = useState(true);
  const [sections, setSections] = useState<EditableSection[]>([]);
  const [selectedLessonKey, setSelectedLessonKey] = useState<string>();
  const [dirty, setDirty] = useState(false);
  useTitle('Редактор шаблона — Академия — TeamOS');

  const templateQuery = useQuery({
    queryKey: queryKeys.academyV2.template(templateId),
    queryFn: ({ signal }) => academyTemplatesApi.getDetail(templateId, undefined, { signal }),
    enabled: Boolean(templateId),
  });
  const draftVersionId = templateQuery.data?.summary.draftVersionId;
  const draftQuery = useQuery({
    queryKey: [...queryKeys.academyV2.template(templateId), 'draft', draftVersionId],
    queryFn: ({ signal }) => academyTemplatesApi.getDetail(templateId, draftVersionId, { signal }),
    enabled: Boolean(templateId && draftVersionId),
  });

  useEffect(() => {
    const version = draftQuery.data?.selectedVersion;
    if (!version) return;
    const nextSections = editableSections(version);
    setTitle(version.title);
    setDescription(version.description ?? '');
    setSequential(version.sequential);
    setSections(nextSections);
    setSelectedLessonKey((current) =>
      nextSections.some((section) => section.lessons.some((lesson) => lesson.stableKey === current))
        ? current
        : nextSections[0]?.lessons[0]?.stableKey,
    );
    setDirty(false);
  }, [draftQuery.data?.selectedVersion]);

  const selectedLesson = useMemo(
    () =>
      sections
        .flatMap((section) => section.lessons)
        .find((lesson) => lesson.stableKey === selectedLessonKey),
    [sections, selectedLessonKey],
  );
  const validationMessage = useMemo(() => {
    if (!title.trim()) return 'Заполните название шаблона.';
    if (sections.some((section) => !section.title.trim())) return 'Заполните названия разделов.';
    if (sections.some((section) => section.lessons.some((lesson) => !lesson.title.trim()))) {
      return 'Заполните названия уроков.';
    }
    for (const lesson of sections.flatMap((section) => section.lessons)) {
      const error = lesson.quiz
        ? validateQuiz(lesson.quiz).find((issue) => issue.severity === 'error')
        : undefined;
      if (error) return error.message;
    }
    return undefined;
  }, [sections, title]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.template(templateId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.templatesRoot });
  };
  const ensureDraft = useMutation({
    mutationFn: () => academyTemplatesApi.createDraft(templateId, { idempotencyKey: createId() }),
    onSuccess: () => {
      invalidate();
      toast.success('Черновик шаблона создан');
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Не удалось создать черновик'),
  });
  const save = useMutation({
    mutationFn: () =>
      academyTemplatesApi.updateDraft(templateId, {
        title: title.trim(),
        description: description.trim() || undefined,
        sequential,
        content: { sections: apiSections(sections) },
      }),
    onSuccess: (version) => {
      const nextSections = editableSections(version);
      setSections(nextSections);
      setSelectedLessonKey((current) => current ?? nextSections[0]?.lessons[0]?.stableKey);
      setDirty(false);
      invalidate();
      toast.success('Шаблон сохранён');
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Не удалось сохранить шаблон'),
  });
  const publish = useMutation({
    mutationFn: () => academyTemplatesApi.publish(templateId, { idempotencyKey: createId() }),
    onSuccess: () => {
      invalidate();
      toast.success('Новая версия шаблона опубликована');
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Не удалось опубликовать шаблон'),
  });

  const updateSections = (next: EditableSection[]) => {
    setSections(
      next.map((section, sectionIndex) => ({
        ...section,
        order: sectionIndex,
        lessons: section.lessons.map((lesson, lessonIndex) => ({
          ...lesson,
          order: lessonIndex,
        })),
      })),
    );
    setDirty(true);
  };

  if (templateQuery.isError || draftQuery.isError) {
    return (
      <div className="p-6">
        <ErrorState
          title="Редактор шаблона недоступен"
          onRetry={() => {
            void templateQuery.refetch();
            void draftQuery.refetch();
          }}
        />
      </div>
    );
  }
  if (!templateQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Загружаем шаблон…
      </div>
    );
  }
  const template = templateQuery.data.summary;
  if (!template.capabilities.canEdit) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <EmptyState
          icon={FileStack}
          title="Редактирование недоступно"
          description="Системные шаблоны доступны только для просмотра и создания курса."
          action={
            <Link to={academyRoutes.template(templateId)}>
              <Button variant="secondary">К шаблону</Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (!draftVersionId) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <EmptyState
          icon={FileStack}
          title="Нет активного черновика"
          description="Создайте следующую редактируемую версию из последней опубликованной."
          action={
            <Button loading={ensureDraft.isPending} onClick={() => ensureDraft.mutate()}>
              Создать черновик
            </Button>
          }
        />
      </div>
    );
  }

  if (!draftQuery.data?.selectedVersion) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Загружаем содержимое черновика…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-surface px-4 py-3">
        <div>
          <Link
            className="text-sm text-slate-500 hover:text-primary-700"
            to={academyRoutes.template(templateId)}
          >
            ← К шаблону
          </Link>
          <h1 className="text-lg font-semibold text-slate-950">
            Конструктор корпоративного шаблона
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={!dirty || Boolean(validationMessage)}
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            Сохранить
          </Button>
          <Button
            disabled={dirty || sections.length === 0 || Boolean(validationMessage)}
            loading={publish.isPending}
            onClick={() => publish.mutate()}
          >
            Опубликовать
          </Button>
        </div>
      </header>

      <main className="grid min-h-[calc(100vh-65px)] lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4 border-r border-slate-200 bg-surface p-4">
          <Input
            label="Название"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setDirty(true);
            }}
          />
          <Textarea
            label="Описание"
            value={description}
            rows={3}
            onChange={(event) => {
              setDescription(event.target.value);
              setDirty(true);
            }}
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={sequential}
              onChange={(event) => {
                setSequential(event.target.checked);
                setDirty(true);
              }}
            />
            Последовательное прохождение
          </label>

          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Структура</h2>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                updateSections([
                  ...sections,
                  {
                    stableKey: createId(),
                    title: `Раздел ${sections.length + 1}`,
                    order: sections.length,
                    lessons: [],
                  },
                ])
              }
            >
              <Plus className="size-4" />
              Раздел
            </Button>
          </div>

          <ol className="space-y-3">
            {sections.map((section, sectionIndex) => (
              <li key={section.stableKey} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center gap-1">
                  <Input
                    aria-label={`Название раздела ${sectionIndex + 1}`}
                    value={section.title}
                    onChange={(event) =>
                      updateSections(
                        sections.map((item) =>
                          item.stableKey === section.stableKey
                            ? { ...item, title: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Поднять раздел"
                    disabled={sectionIndex === 0}
                    onClick={() =>
                      updateSections(reorder(sections, sectionIndex, sectionIndex - 1))
                    }
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Опустить раздел"
                    disabled={sectionIndex === sections.length - 1}
                    onClick={() =>
                      updateSections(reorder(sections, sectionIndex, sectionIndex + 1))
                    }
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Удалить раздел"
                    onClick={() => {
                      const removedKeys = new Set(
                        section.lessons.map((lesson) => lesson.stableKey),
                      );
                      updateSections(
                        sections.filter((item) => item.stableKey !== section.stableKey),
                      );
                      if (selectedLessonKey && removedKeys.has(selectedLessonKey)) {
                        setSelectedLessonKey(undefined);
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <ol className="mt-2 space-y-1">
                  {section.lessons.map((lesson, lessonIndex) => (
                    <li key={lesson.stableKey} className="flex items-center gap-1">
                      <button
                        type="button"
                        className={
                          selectedLessonKey === lesson.stableKey
                            ? 'min-w-0 flex-1 truncate rounded-md bg-primary-50 px-2 py-1.5 text-left text-sm font-medium text-primary-800'
                            : 'min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-50'
                        }
                        onClick={() => setSelectedLessonKey(lesson.stableKey)}
                      >
                        {lesson.title || 'Без названия'}
                      </button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Поднять урок"
                        disabled={lessonIndex === 0}
                        onClick={() =>
                          updateSections(
                            sections.map((item) =>
                              item.stableKey === section.stableKey
                                ? {
                                    ...item,
                                    lessons: reorder(item.lessons, lessonIndex, lessonIndex - 1),
                                  }
                                : item,
                            ),
                          )
                        }
                      >
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Опустить урок"
                        disabled={lessonIndex === section.lessons.length - 1}
                        onClick={() =>
                          updateSections(
                            sections.map((item) =>
                              item.stableKey === section.stableKey
                                ? {
                                    ...item,
                                    lessons: reorder(item.lessons, lessonIndex, lessonIndex + 1),
                                  }
                                : item,
                            ),
                          )
                        }
                      >
                        <ArrowDown className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Удалить урок"
                        onClick={() => {
                          updateSections(
                            sections.map((item) =>
                              item.stableKey === section.stableKey
                                ? {
                                    ...item,
                                    lessons: item.lessons.filter(
                                      (candidate) => candidate.stableKey !== lesson.stableKey,
                                    ),
                                  }
                                : item,
                            ),
                          );
                          if (selectedLessonKey === lesson.stableKey) {
                            setSelectedLessonKey(undefined);
                          }
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ol>
                <Button
                  className="mt-2 w-full"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const stableKey = createId();
                    updateSections(
                      sections.map((item) =>
                        item.stableKey === section.stableKey
                          ? {
                              ...item,
                              lessons: [
                                ...item.lessons,
                                {
                                  stableKey,
                                  title: `Урок ${item.lessons.length + 1}`,
                                  order: item.lessons.length,
                                  content: EMPTY_DOCUMENT,
                                  sourceType: 'manual',
                                },
                              ],
                            }
                          : item,
                      ),
                    );
                    setSelectedLessonKey(stableKey);
                  }}
                >
                  <Plus className="size-4" />
                  Добавить урок
                </Button>
              </li>
            ))}
          </ol>
          {validationMessage ? (
            <p className="rounded-lg bg-danger-50 p-3 text-sm text-danger-700">
              {validationMessage}
            </p>
          ) : null}
        </aside>

        <section className="min-w-0 p-4 sm:p-6">
          {selectedLesson ? (
            <div className="mx-auto max-w-4xl space-y-5">
              <Input
                label="Название урока"
                value={selectedLesson.title}
                onChange={(event) =>
                  updateSections(
                    sections.map((section) => ({
                      ...section,
                      lessons: section.lessons.map((lesson) =>
                        lesson.stableKey === selectedLesson.stableKey
                          ? { ...lesson, title: event.target.value }
                          : lesson,
                      ),
                    })),
                  )
                }
              />
              <RichTextEditor
                value={selectedLesson.content}
                onChange={(content) =>
                  updateSections(
                    sections.map((section) => ({
                      ...section,
                      lessons: section.lessons.map((lesson) =>
                        lesson.stableKey === selectedLesson.stableKey
                          ? { ...lesson, content }
                          : lesson,
                      ),
                    })),
                  )
                }
              />
              {selectedLesson.quiz ? (
                <QuizEditor
                  quiz={selectedLesson.quiz}
                  onChange={(quiz) =>
                    updateSections(
                      sections.map((section) => ({
                        ...section,
                        lessons: section.lessons.map((lesson) =>
                          lesson.stableKey === selectedLesson.stableKey
                            ? { ...lesson, quiz }
                            : lesson,
                        ),
                      })),
                    )
                  }
                  onRemove={() =>
                    updateSections(
                      sections.map((section) => ({
                        ...section,
                        lessons: section.lessons.map((lesson) =>
                          lesson.stableKey === selectedLesson.stableKey
                            ? { ...lesson, quiz: undefined }
                            : lesson,
                        ),
                      })),
                    )
                  }
                />
              ) : (
                <Button
                  variant="secondary"
                  onClick={() =>
                    updateSections(
                      sections.map((section) => ({
                        ...section,
                        lessons: section.lessons.map((lesson) =>
                          lesson.stableKey === selectedLesson.stableKey
                            ? {
                                ...lesson,
                                quiz: {
                                  id: createId(),
                                  lessonId: selectedLesson.stableKey,
                                  questions: [],
                                  passingScore: 80,
                                },
                              }
                            : lesson,
                        ),
                      })),
                    )
                  }
                >
                  Добавить тест
                </Button>
              )}
            </div>
          ) : (
            <EmptyState
              icon={FileStack}
              title="Выберите или добавьте урок"
              description="Слева находится структура редактируемой версии шаблона."
            />
          )}
        </section>
      </main>
    </div>
  );
}
