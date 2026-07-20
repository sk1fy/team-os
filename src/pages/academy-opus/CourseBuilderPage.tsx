/**
 * Конструктор курса Академии Opus.
 *
 * Структура и содержимое редактируются на одном экране: слева дерево
 * разделов и уроков, справа — редактор выбранного урока. Порядок меняется
 * стрелками, а не перетаскиванием: так работает с клавиатуры и не требует
 * отдельного состояния перетаскивания.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  FolderPlus,
  ListPlus,
  PlayCircle,
  Save,
  Settings2,
  Trash2,
} from 'lucide-react';
import { academyOpusApi } from '@/api/academyOpus';
import { httpAuthApi } from '@/api/http';
import { queryKeys } from '@/api/queryKeys';
import { ApiError } from '@/api/client';
import type { CourseSection, ID, Lesson, RichTextContent } from '@/types';
import { Badge, Button, Input, Modal, RichTextEditor } from '@/components/ui';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { cn } from '@/lib/cn';
import { plural } from '@/lib/format';
import { canManageContent } from '@/lib/permissions';
import { toast } from '@/stores/toast';
import { CourseSettingsDrawer } from './drawers';

const emptySections: CourseSection[] = [];
const emptyLessons: Lesson[] = [];

const showError = (fallback: string) => (error: unknown) =>
  toast.error(error instanceof ApiError ? error.message : fallback);

export function CourseBuilderPage() {
  const { courseId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedLessonId, setSelectedLessonId] = useState<ID | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; text: string; run: () => void } | null>(
    null,
  );

  const currentUserQuery = useQuery({
    queryKey: queryKeys.academyOpus.currentUser,
    queryFn: httpAuthApi.getCurrentUser,
  });
  const courseQuery = useQuery({
    queryKey: queryKeys.academyOpus.course(courseId),
    queryFn: () => academyOpusApi.getCourse(courseId),
    enabled: Boolean(courseId),
  });
  const sectionsQuery = useQuery({
    queryKey: queryKeys.academyOpus.sectionsFor(courseId),
    queryFn: () => academyOpusApi.getSections(courseId),
    enabled: Boolean(courseId),
  });
  const lessonsQuery = useQuery({
    queryKey: queryKeys.academyOpus.lessonsFor(courseId),
    queryFn: () => academyOpusApi.getLessons(courseId),
    enabled: Boolean(courseId),
  });

  const course = courseQuery.data;
  useTitle(course ? `${course.title} — конструктор — TeamOS` : 'Конструктор курса — TeamOS');
  const canEdit = canManageContent(currentUserQuery.data?.role);

  const sections = useMemo(
    () => (sectionsQuery.data ?? emptySections).slice().sort((a, b) => a.order - b.order),
    [sectionsQuery.data],
  );
  const lessons = lessonsQuery.data ?? emptyLessons;
  const lessonsBySection = useMemo(() => {
    const map = new Map<ID, Lesson[]>();
    for (const section of sections) {
      map.set(
        section.id,
        lessons
          .filter((lesson) => lesson.sectionId === section.id)
          .sort((a, b) => a.order - b.order),
      );
    }
    return map;
  }, [lessons, sections]);

  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId);

  // Выбранный урок мог быть удалён — не оставляем редактор в подвешенном виде.
  useEffect(() => {
    if (selectedLessonId && !lessons.some((lesson) => lesson.id === selectedLessonId)) {
      setSelectedLessonId(null);
    }
  }, [lessons, selectedLessonId]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.academyOpus.all });
  };

  const createSection = useMutation({
    mutationFn: academyOpusApi.createSection,
    onSuccess: invalidate,
    onError: showError('Не удалось создать раздел'),
  });
  const renameSection = useMutation({
    mutationFn: academyOpusApi.updateSection,
    onSuccess: invalidate,
    onError: showError('Не удалось переименовать раздел'),
  });
  const deleteSection = useMutation({
    mutationFn: academyOpusApi.deleteSection,
    onSuccess: () => {
      toast.success('Раздел удалён');
      invalidate();
    },
    onError: showError('Не удалось удалить раздел'),
  });
  const createLesson = useMutation({
    mutationFn: academyOpusApi.createLesson,
    onSuccess: (lesson) => {
      setSelectedLessonId(lesson.id);
      invalidate();
    },
    onError: showError('Не удалось создать урок'),
  });
  const deleteLesson = useMutation({
    mutationFn: academyOpusApi.deleteLesson,
    onSuccess: () => {
      toast.success('Урок удалён');
      invalidate();
    },
    onError: showError('Не удалось удалить урок'),
  });
  const moveLesson = useMutation({
    mutationFn: academyOpusApi.moveLesson,
    onSuccess: invalidate,
    onError: showError('Не удалось переместить урок'),
  });
  const publish = useMutation({
    mutationFn: academyOpusApi.updateCourse,
    onSuccess: (updated) => {
      toast.success(updated.status === 'published' ? 'Курс опубликован' : 'Курс снят с публикации');
      invalidate();
    },
    onError: showError('Не удалось изменить статус курса'),
  });
  const deleteCourse = useMutation({
    mutationFn: academyOpusApi.deleteCourse,
    onSuccess: () => {
      toast.success('Курс удалён');
      invalidate();
      navigate('/academy-opus');
    },
    onError: showError('Не удалось удалить курс'),
  });

  const addSection = () => {
    const title = `Раздел ${sections.length + 1}`;
    createSection.mutate({ courseId, title });
  };

  const addLesson = (sectionId: ID) =>
    createLesson.mutate({
      courseId,
      sectionId,
      title: `Урок ${(lessonsBySection.get(sectionId)?.length ?? 0) + 1}`,
    });

  if (courseQuery.isError) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <ErrorState onRetry={() => void courseQuery.refetch()} />
      </div>
    );
  }

  if (currentUserQuery.data && !canEdit) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <EmptyState
          icon={Settings2}
          title="Недостаточно прав"
          description="Редактировать курсы могут владелец и администраторы."
        />
      </div>
    );
  }

  const totalLessons = lessons.length;

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/academy-opus"
            className="mb-1 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary-600"
          >
            <ChevronLeft className="size-4" />К каталогу
          </Link>
          <h1 className="flex flex-wrap items-center gap-2">
            {course?.title ?? 'Курс'}
            {course && (
              <Badge variant={course.status === 'published' ? 'success' : 'warning'}>
                {course.status === 'published' ? 'Опубликован' : 'Черновик'}
              </Badge>
            )}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {sections.length} {plural(sections.length, ['раздел', 'раздела', 'разделов'])} ·{' '}
            {totalLessons} {plural(totalLessons, ['урок', 'урока', 'уроков'])}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setSettingsOpen(true)} disabled={!course}>
            <Settings2 className="size-4" />
            Настройки
          </Button>
          <Button
            variant="secondary"
            disabled={totalLessons === 0}
            onClick={() => navigate(`/learn-opus/${courseId}`)}
          >
            <PlayCircle className="size-4" />
            Предпросмотр
          </Button>
          <Button
            loading={publish.isPending}
            disabled={!course || (course.status !== 'published' && totalLessons === 0)}
            onClick={() =>
              course &&
              publish.mutate({
                id: course.id,
                status: course.status === 'published' ? 'draft' : 'published',
              })
            }
          >
            {course?.status === 'published' ? 'Снять с публикации' : 'Опубликовать'}
          </Button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(260px,340px)_1fr]">
        <aside className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-surface p-3 shadow-card">
            {sections.length === 0 ? (
              <p className="px-1 py-3 text-sm text-slate-500">
                Разделов пока нет. Начните с первого — уроки добавляются внутрь раздела.
              </p>
            ) : (
              <ul className="space-y-3">
                {sections.map((section) => {
                  const sectionLessons = lessonsBySection.get(section.id) ?? [];
                  return (
                    <li key={section.id}>
                      <div className="flex items-center gap-1">
                        <Input
                          className="flex-1"
                          aria-label="Название раздела"
                          defaultValue={section.title}
                          key={`${section.id}-${section.title}`}
                          onBlur={(event) => {
                            const title = event.target.value.trim();
                            if (title && title !== section.title) {
                              renameSection.mutate({ id: section.id, title });
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

                      <ul className="mt-1.5 space-y-1 pl-2">
                        {sectionLessons.map((lesson, index) => (
                          <li key={lesson.id} className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedLessonId(lesson.id)}
                              className={cn(
                                'flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                                lesson.id === selectedLessonId
                                  ? 'bg-primary-50 font-medium text-primary-900'
                                  : 'text-slate-600 hover:bg-slate-100',
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
                              disabled={index === sectionLessons.length - 1 || moveLesson.isPending}
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
                            loading={createLesson.isPending}
                            onClick={() => addLesson(section.id)}
                          >
                            <ListPlus className="size-4" />
                            Урок
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
            onClick={addSection}
          >
            <FolderPlus className="size-4" />
            Добавить раздел
          </Button>

          <Button
            variant="ghost"
            className="w-full text-danger-600 hover:bg-danger-50"
            onClick={() =>
              course &&
              setConfirm({
                title: 'Удалить курс?',
                text: `Курс «${course.title}» будет удалён вместе с уроками, назначениями и прогрессом. Отменить нельзя.`,
                run: () => deleteCourse.mutate(course.id),
              })
            }
          >
            <Trash2 className="size-4" />
            Удалить курс
          </Button>
        </aside>

        <section>
          {selectedLesson ? (
            <LessonEditor
              key={selectedLesson.id}
              lesson={selectedLesson}
              sections={sections}
              onMoveToSection={(sectionId) =>
                moveLesson.mutate({
                  id: selectedLesson.id,
                  sectionId,
                  order: lessonsBySection.get(sectionId)?.length ?? 0,
                })
              }
              onDelete={() =>
                setConfirm({
                  title: 'Удалить урок?',
                  text: `Урок «${selectedLesson.title}» и его тест будут удалены.`,
                  run: () => deleteLesson.mutate(selectedLesson.id),
                })
              }
            />
          ) : (
            <EmptyState
              icon={ListPlus}
              title="Выберите урок"
              description="Слева — структура курса. Выберите урок, чтобы отредактировать его содержимое, или добавьте новый."
            />
          )}
        </section>
      </div>

      <CourseSettingsDrawer
        course={course}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      <Modal
        open={confirm !== null}
        onOpenChange={(next) => !next && setConfirm(null)}
        title={confirm?.title ?? ''}
        size="sm"
        footer={
          <>
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
              Удалить
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">{confirm?.text}</p>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Редактор урока
// ---------------------------------------------------------------------------

function LessonEditor({
  lesson,
  sections,
  onMoveToSection,
  onDelete,
}: {
  lesson: Lesson;
  sections: CourseSection[];
  onMoveToSection: (sectionId: ID) => void;
  onDelete: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(lesson.title);
  const [content, setContent] = useState<RichTextContent>(lesson.content);
  const [dirty, setDirty] = useState(false);

  /** Урок из БЗ в режиме «Ссылка» — контент живёт в статье, править нельзя. */
  const linked = lesson.sourceMode === 'link' && Boolean(lesson.sourceArticleId);

  const save = useMutation({
    mutationFn: academyOpusApi.updateLesson,
    onSuccess: () => {
      setDirty(false);
      toast.success('Урок сохранён');
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyOpus.all });
    },
    onError: showError('Не удалось сохранить урок'),
  });

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
            loading={save.isPending}
            disabled={!dirty || !title.trim()}
            onClick={() =>
              save.mutate({
                id: lesson.id,
                title: title.trim(),
                ...(linked ? {} : { content }),
              })
            }
          >
            <Save className="size-4" />
            Сохранить
          </Button>
          <Button variant="ghost" aria-label="Удалить урок" onClick={onDelete}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {sections.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">Раздел:</span>
          {sections.map((section) => (
            <Button
              key={section.id}
              size="sm"
              variant={section.id === lesson.sectionId ? 'primary' : 'secondary'}
              onClick={() => section.id !== lesson.sectionId && onMoveToSection(section.id)}
            >
              {section.title}
            </Button>
          ))}
        </div>
      )}

      {linked ? (
        <p className="rounded-md bg-primary-50 px-3 py-2 text-sm text-primary-900">
          Урок синхронизирован со статьёй базы знаний — содержимое правится там.
        </p>
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
