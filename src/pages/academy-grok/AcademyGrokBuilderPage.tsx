/**
 * Конструктор курса Академии Grok.
 *
 * Слева — дерево разделов и уроков (переименование, порядок, удаление),
 * справа — редактор выбранного урока. Настройки курса — в боковой панели.
 * Стиль и UX ближе к остальной Академии Grok, а не к классической Академии.
 */

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
  Sparkles,
  Trash2,
} from 'lucide-react';
import { httpAcademyApi, httpAuthApi } from '@/api/http';
import { queryKeys } from '@/api/queryKeys';
import type { Course, CourseSection, CourseVisibility, ID, Lesson, RichTextContent } from '@/types';
import {
  Badge,
  Button,
  Checkbox,
  Drawer,
  Input,
  Modal,
  RichTextEditor,
  Select,
  Textarea,
} from '@/components/ui';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { cn } from '@/lib/cn';
import { plural } from '@/lib/format';
import { canManageContent } from '@/lib/permissions';
import { toast } from '@/stores/toast';
import { courseCoverClass, showApiError, statusLabels, visibilityLabels } from './utils';

const emptySections: CourseSection[] = [];
const emptyLessons: Lesson[] = [];

export function AcademyGrokBuilderPage() {
  const { courseId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedLessonId, setSelectedLessonId] = useState<ID | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; text: string; run: () => void } | null>(
    null,
  );

  const currentUserQuery = useQuery({
    queryKey: queryKeys.academyGrok.currentUser,
    queryFn: httpAuthApi.getCurrentUser,
  });
  const courseQuery = useQuery({
    queryKey: queryKeys.academyGrok.course(courseId),
    queryFn: () => httpAcademyApi.getCourse(courseId),
    enabled: Boolean(courseId),
  });
  const sectionsQuery = useQuery({
    queryKey: queryKeys.academyGrok.sectionsFor(courseId),
    queryFn: () => httpAcademyApi.getCourseSections(courseId),
    enabled: Boolean(courseId),
  });
  const lessonsQuery = useQuery({
    queryKey: queryKeys.academyGrok.lessonsFor(courseId),
    queryFn: () => httpAcademyApi.getLessons(courseId),
    enabled: Boolean(courseId),
  });

  const course = courseQuery.data;
  const canEdit = canManageContent(currentUserQuery.data?.role);
  useTitle(course ? `${course.title} — конструктор — TeamOS` : 'Конструктор курса — TeamOS');

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

  useEffect(() => {
    if (selectedLessonId && !lessons.some((lesson) => lesson.id === selectedLessonId)) {
      setSelectedLessonId(null);
    }
  }, [lessons, selectedLessonId]);

  // Если есть уроки, но ничего не выбрано — открываем первый (удобнее с готовым планом).
  useEffect(() => {
    if (selectedLessonId || lessons.length === 0) return;
    const firstSection = sections[0];
    if (!firstSection) return;
    const firstLesson = lessonsBySection.get(firstSection.id)?.[0];
    if (firstLesson) setSelectedLessonId(firstLesson.id);
  }, [lessons, lessonsBySection, sections, selectedLessonId]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.academyGrok.all });
  };

  const createSection = useMutation({
    mutationFn: httpAcademyApi.createCourseSection,
    onSuccess: invalidate,
    onError: (error) => toast.error(showApiError(error, 'Не удалось создать раздел')),
  });
  const renameSection = useMutation({
    mutationFn: httpAcademyApi.updateCourseSection,
    onSuccess: invalidate,
    onError: (error) => toast.error(showApiError(error, 'Не удалось переименовать раздел')),
  });
  const deleteSection = useMutation({
    mutationFn: httpAcademyApi.deleteCourseSection,
    onSuccess: () => {
      toast.success('Раздел удалён');
      invalidate();
    },
    onError: (error) => toast.error(showApiError(error, 'Не удалось удалить раздел')),
  });
  const createLesson = useMutation({
    mutationFn: httpAcademyApi.createLesson,
    onSuccess: (lesson) => {
      setSelectedLessonId(lesson.id);
      invalidate();
    },
    onError: (error) => toast.error(showApiError(error, 'Не удалось создать урок')),
  });
  const deleteLesson = useMutation({
    mutationFn: httpAcademyApi.deleteLesson,
    onSuccess: () => {
      toast.success('Урок удалён');
      invalidate();
    },
    onError: (error) => toast.error(showApiError(error, 'Не удалось удалить урок')),
  });
  const moveLesson = useMutation({
    mutationFn: httpAcademyApi.moveLesson,
    onSuccess: invalidate,
    onError: (error) => toast.error(showApiError(error, 'Не удалось переместить урок')),
  });
  const publish = useMutation({
    mutationFn: httpAcademyApi.updateCourse,
    onSuccess: (updated) => {
      toast.success(
        updated.status === 'published' ? 'Курс опубликован' : 'Курс переведён в черновики',
      );
      invalidate();
    },
    onError: (error) => toast.error(showApiError(error, 'Не удалось изменить статус')),
  });
  const deleteCourse = useMutation({
    mutationFn: httpAcademyApi.deleteCourse,
    onSuccess: () => {
      toast.success('Курс удалён');
      invalidate();
      navigate('/academy-grok/catalog');
    },
    onError: (error) => toast.error(showApiError(error, 'Не удалось удалить курс')),
  });

  const addSection = () => {
    createSection.mutate({ courseId, title: `Раздел ${sections.length + 1}` });
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
          action={
            <Link to="/academy-grok">
              <Button variant="secondary">К обучению</Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (courseQuery.isPending || !course) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="h-10 w-56 animate-pulse rounded bg-slate-200" />
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="h-80 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-80 animate-pulse rounded-xl bg-slate-100" />
        </div>
      </div>
    );
  }

  const totalLessons = lessons.length;

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-6">
      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              to={`/academy-grok/courses/${courseId}`}
              className="mb-1 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary-600"
            >
              <ChevronLeft className="size-4" />К карточке курса
            </Link>
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-slate-950">
              {course.title}
              <Badge variant={course.status === 'published' ? 'success' : 'warning'}>
                {statusLabels[course.status]}
              </Badge>
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Конструктор · {sections.length}{' '}
              {plural(sections.length, ['раздел', 'раздела', 'разделов'])} · {totalLessons}{' '}
              {plural(totalLessons, ['урок', 'урока', 'уроков'])}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="size-4" />
              Настройки
            </Button>
            <Button
              variant="secondary"
              disabled={totalLessons === 0}
              onClick={() => navigate(`/learn-grok/${courseId}`)}
            >
              <Eye className="size-4" />
              Предпросмотр
            </Button>
            <Button
              loading={publish.isPending}
              disabled={course.status !== 'published' && totalLessons === 0}
              onClick={() =>
                publish.mutate({
                  id: course.id,
                  status: course.status === 'published' ? 'draft' : 'published',
                })
              }
            >
              {course.status === 'published' ? 'В черновик' : 'Опубликовать'}
            </Button>
          </div>
        </div>

        <div
          className={`relative overflow-hidden rounded-xl bg-gradient-to-r px-4 py-3 text-white ${courseCoverClass(course.id)}`}
        >
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative flex flex-wrap items-center gap-3 text-sm">
            <Sparkles className="size-4 shrink-0 opacity-90" />
            <span className="font-medium">
              {visibilityLabels[course.visibility]}
              {course.sequential ? ' · по шагам' : ' · свободный порядок'}
              {course.deadlineDays ? ` · ${course.deadlineDays} дн. на прохождение` : ''}
            </span>
            <span className="text-white/75">
              Выберите урок слева и наполните содержимое справа.
            </span>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,340px)_1fr]">
        <aside className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-surface p-3 shadow-card">
            {sections.length === 0 ? (
              <div className="px-1 py-6 text-center">
                <p className="text-sm font-medium text-slate-800">Структура пуста</p>
                <p className="mt-1 text-xs text-slate-500">
                  Добавьте первый раздел — уроки создаются внутри него.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {sections.map((section) => {
                  const sectionLessons = lessonsBySection.get(section.id) ?? [];
                  return (
                    <li
                      key={section.id}
                      className="rounded-lg border border-slate-100 bg-slate-50/80 p-2"
                    >
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
                              onClick={() => setSelectedLessonId(lesson.id)}
                              className={cn(
                                'min-w-0 flex-1 truncate rounded-md px-2.5 py-1.5 text-left text-sm transition-colors',
                                lesson.id === selectedLessonId
                                  ? 'bg-primary-600 font-medium text-white shadow-sm'
                                  : 'bg-white text-slate-700 hover:bg-primary-50 hover:text-primary-900',
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
                            className="w-full justify-start"
                            loading={createLesson.isPending}
                            onClick={() => addLesson(section.id)}
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
            onClick={addSection}
          >
            <FolderPlus className="size-4" />
            Добавить раздел
          </Button>

          <Button
            variant="ghost"
            className="w-full text-danger-600 hover:bg-danger-50"
            onClick={() =>
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
                  text: `Урок «${selectedLesson.title}» и связанные данные будут удалены.`,
                  run: () => deleteLesson.mutate(selectedLesson.id),
                })
              }
            />
          ) : (
            <div className="flex min-h-80 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-surface">
              <EmptyState
                icon={ListPlus}
                title="Выберите урок"
                description="Слева — структура курса. Добавьте раздел и урок, затем отредактируйте содержимое здесь."
              />
            </div>
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

  const linked = lesson.sourceMode === 'link' && Boolean(lesson.sourceArticleId);

  const save = useMutation({
    mutationFn: httpAcademyApi.updateLesson,
    onSuccess: () => {
      setDirty(false);
      toast.success('Урок сохранён');
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyGrok.all });
    },
    onError: (error) => toast.error(showApiError(error, 'Не удалось сохранить урок')),
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-surface p-4 shadow-card sm:p-5">
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
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Раздел
          </p>
          <div className="flex flex-wrap gap-2">
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
        </div>
      )}

      {linked ? (
        <p className="rounded-lg bg-primary-50 px-3 py-2.5 text-sm text-primary-900">
          Урок синхронизирован со статьёй базы знаний — содержимое правится там. Здесь можно
          изменить только название.
        </p>
      ) : (
        <RichTextEditor
          value={content}
          onChange={(next) => {
            setContent(next);
            setDirty(true);
          }}
          minHeight={380}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Настройки курса
// ---------------------------------------------------------------------------

function CourseSettingsDrawer({
  course,
  open,
  onClose,
}: {
  course: Course;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: course.title,
    description: course.description ?? '',
    published: course.status === 'published',
    visibility: course.visibility,
    sequential: course.sequential,
    deadlineDays: course.deadlineDays ? String(course.deadlineDays) : '',
  });

  useEffect(() => {
    setForm({
      title: course.title,
      description: course.description ?? '',
      published: course.status === 'published',
      visibility: course.visibility,
      sequential: course.sequential,
      deadlineDays: course.deadlineDays ? String(course.deadlineDays) : '',
    });
  }, [course]);

  const save = useMutation({
    mutationFn: httpAcademyApi.updateCourse,
    onSuccess: () => {
      toast.success('Настройки сохранены');
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyGrok.all });
      onClose();
    },
    onError: (error) => toast.error(showApiError(error, 'Не удалось сохранить настройки')),
  });

  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()} title="Настройки курса" size="md">
      <div className="space-y-4">
        <Input
          label="Название"
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />
        <Textarea
          label="Описание"
          rows={3}
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
          placeholder="Кратко о курсе"
        />
        <Select
          label="Видимость"
          value={form.visibility}
          onValueChange={(value) => setForm({ ...form, visibility: value as CourseVisibility })}
          options={[
            { value: 'restricted', label: 'Только по назначению' },
            { value: 'company', label: 'Вся компания' },
            { value: 'public', label: 'Публичный по ссылке' },
          ]}
        />
        <Input
          label="Дедлайн, дней с назначения"
          type="number"
          min={0}
          value={form.deadlineDays}
          onChange={(event) => setForm({ ...form, deadlineDays: event.target.value })}
          hint="Пусто — без дедлайна"
        />
        <Checkbox
          checked={form.sequential}
          onCheckedChange={(checked) => setForm({ ...form, sequential: checked })}
          label="Последовательное прохождение"
        />
        <Checkbox
          checked={form.published}
          onCheckedChange={(checked) => setForm({ ...form, published: checked })}
          label="Опубликован"
        />
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Отмена
        </Button>
        <Button
          loading={save.isPending}
          disabled={!form.title.trim()}
          onClick={() =>
            save.mutate({
              id: course.id,
              title: form.title.trim() || course.title,
              description: form.description,
              status: form.published ? 'published' : 'draft',
              visibility: form.visibility,
              sequential: form.sequential,
              deadlineDays: Number(form.deadlineDays) || 0,
            })
          }
        >
          Сохранить
        </Button>
      </div>
    </Drawer>
  );
}
