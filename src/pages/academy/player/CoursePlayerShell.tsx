import { useEffect, useMemo, useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  LockKeyhole,
  PanelLeft,
  PlayCircle,
  X,
} from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { academyVersionsApi } from '@/api/academy';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { CourseVersionLearnerDetail, LessonLearner } from '@/types/academy';
import { AcademyStatusCallout } from '../components/AcademyStatusCallout';
import { LessonArticle } from './LessonArticle';
import { QuizRunner } from './QuizRunner';
export type CoursePlayerMode = 'internal' | 'external' | 'preview';

export interface CoursePlayerShellProps {
  mode: CoursePlayerMode;
  title: string;
  percent: number;
  headerLeft?: ReactNode;
  headerMeta?: ReactNode;
  outline: CourseVersionLearnerDetail;
  currentLessonId?: string;
  onSelectLesson: (lessonId: string) => void;
  /** Makes the full outline non-interactive for globally unavailable access states. */
  outlineReadOnly?: boolean;
  outlineToggleIcon?: ReactNode;
  callout?: ReactNode;
  content: ReactNode;
  footer?: ReactNode;
}

/**
 * Shared presentation shell for internal, external and preview players.
 * Does not fetch data — adapters pass outline, progress and callbacks.
 */
export function CoursePlayerShell({
  mode,
  title,
  percent,
  headerLeft,
  headerMeta,
  outline,
  currentLessonId,
  onSelectLesson,
  outlineReadOnly = false,
  outlineToggleIcon,
  callout,
  content,
  footer,
}: CoursePlayerShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const orderedLessons = useMemo(
    () =>
      outline.sections
        .slice()
        .sort((a, b) => a.order - b.order)
        .flatMap((section) => section.lessons.slice().sort((a, b) => a.order - b.order)),
    [outline],
  );
  const currentLessonIndex = orderedLessons.findIndex((lesson) => lesson.id === currentLessonId);
  const currentLesson = currentLessonIndex >= 0 ? orderedLessons[currentLessonIndex] : undefined;

  const outlinePanel = (
    <CourseOutlinePanel
      outline={outline}
      currentLessonId={currentLessonId}
      readOnly={outlineReadOnly}
      onSelectLesson={(id) => {
        onSelectLesson(id);
        setMobileOpen(false);
      }}
    />
  );

  return (
    <div className="flex min-h-screen flex-col bg-page" data-player-mode={mode}>
      <header className="sticky top-0 z-20 flex min-h-16 items-center gap-3 border-b border-slate-200 bg-surface/95 px-3 py-2 backdrop-blur sm:px-4">
        {headerLeft}
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Открыть программу курса"
        >
          {outlineToggleIcon ?? '☰'}
        </button>
        <button
          type="button"
          className="hidden items-center justify-center rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:inline-flex"
          onClick={() => setDesktopCollapsed((v) => !v)}
          aria-label={desktopCollapsed ? 'Показать программу' : 'Скрыть программу'}
        >
          {outlineToggleIcon ?? '☰'}
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-slate-900 sm:text-base" title={title}>
            {title}
          </h1>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            {currentLesson ? (
              <p
                className="flex min-w-0 items-center gap-1 text-xs text-slate-600"
                title={
                  currentLesson.locked
                    ? `${currentLesson.title}. ${currentLesson.lockReason ?? 'Урок пока недоступен'}`
                    : currentLesson.title
                }
              >
                <span className="shrink-0 font-medium">
                  Урок {currentLessonIndex + 1} из {orderedLessons.length}
                </span>
                <span aria-hidden>·</span>
                <span className="truncate">{currentLesson.title}</span>
                {currentLesson.locked ? (
                  <span className="sr-only">
                    . {currentLesson.lockReason ?? 'Урок пока недоступен'}
                  </span>
                ) : null}
              </p>
            ) : null}
            <div className="flex shrink-0 items-center gap-2">
              <div
                className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200 sm:w-32"
                role="progressbar"
                aria-label="Прогресс курса"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(100, Math.max(0, percent))}
              >
                <div
                  className="h-full rounded-full bg-primary-500 transition-[width] duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                />
              </div>
              <span className="text-xs font-medium tabular-nums text-slate-500">{percent}%</span>
            </div>
          </div>
        </div>
        {headerMeta ? <div className="hidden shrink-0 sm:block">{headerMeta}</div> : null}
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            'hidden shrink-0 overflow-y-auto border-r border-slate-200 bg-surface lg:block',
            desktopCollapsed ? 'w-0 border-0' : 'w-72',
          )}
        >
          {!desktopCollapsed ? outlinePanel : null}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          {callout ? (
            <div className="px-4 pt-4 sm:px-6">
              <div className="mx-auto max-w-3xl">{callout}</div>
            </div>
          ) : null}
          <div className="flex-1">{content}</div>
          {footer ? (
            <div className="sticky bottom-0 border-t border-slate-200 bg-surface px-4 py-3 sm:px-6">
              {footer}
            </div>
          ) : null}
        </div>
      </div>

      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 lg:hidden" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[min(100%,20rem)] flex-col bg-surface shadow-xl outline-none lg:hidden">
            <div className="flex h-14 items-center justify-between border-b border-slate-200 px-3">
              <Dialog.Title className="text-sm font-semibold">Программа курса</Dialog.Title>
              <Dialog.Close
                className="inline-flex h-8 items-center justify-center rounded-md px-3 text-slate-600 hover:bg-slate-100"
                aria-label="Закрыть"
              >
                <X className="size-4" />
              </Dialog.Close>
            </div>
            <div className="flex-1 overflow-y-auto">{outlinePanel}</div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function CourseOutlinePanel({
  outline,
  currentLessonId,
  onSelectLesson,
  readOnly,
}: {
  outline: CourseVersionLearnerDetail;
  currentLessonId?: string;
  onSelectLesson: (lessonId: string) => void;
  readOnly: boolean;
}) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const currentSection = outline.sections.find((section) =>
      section.lessons.some((lesson) => lesson.id === currentLessonId),
    );
    if (!currentSection) return;
    setCollapsedSections((current) => {
      if (!current.has(currentSection.id)) return current;
      const next = new Set(current);
      next.delete(currentSection.id);
      return next;
    });
  }, [currentLessonId, outline.sections]);

  return (
    <nav className="p-3" aria-label="Программа курса">
      <div className="mb-4 px-2 pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Программа курса
        </p>
        <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-slate-900">
          {outline.title}
        </p>
      </div>
      <ul className="space-y-2">
        {outline.sections.map((section) => {
          const completedCount = section.lessons.filter((lesson) => lesson.completed).length;
          const totalCount = section.lessons.length;
          const sectionPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
          const collapsed = collapsedSections.has(section.id);
          const sectionComplete = totalCount > 0 && completedCount === totalCount;

          return (
            <li
              key={section.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-surface"
            >
              <button
                type="button"
                className="flex w-full items-start gap-2 px-3 py-3 text-left hover:bg-slate-50"
                onClick={() =>
                  setCollapsedSections((current) => {
                    const next = new Set(current);
                    if (next.has(section.id)) next.delete(section.id);
                    else next.add(section.id);
                    return next;
                  })
                }
                aria-expanded={!collapsed}
                aria-controls={`course-section-${section.id}`}
              >
                {sectionComplete ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <span className="mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border border-slate-300 text-[9px] font-semibold text-slate-500">
                    {completedCount}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold leading-4 text-slate-800">
                    {section.title}
                  </span>
                  <span className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span>
                      {completedCount} из {totalCount} уроков
                    </span>
                    <span>{Math.round(sectionPercent)}%</span>
                  </span>
                  <span
                    className="mt-1.5 block h-1 overflow-hidden rounded-full bg-slate-100"
                    role="progressbar"
                    aria-label={`Прогресс раздела «${section.title}»`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(sectionPercent)}
                  >
                    <span
                      className="block h-full rounded-full bg-primary-500 transition-[width] duration-300"
                      style={{ width: `${sectionPercent}%` }}
                    />
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    'mt-0.5 size-4 shrink-0 text-slate-400 transition-transform',
                    collapsed && '-rotate-90',
                  )}
                  aria-hidden
                />
              </button>
              <ul
                id={`course-section-${section.id}`}
                className={cn('space-y-0.5 border-t border-slate-100 p-1.5', collapsed && 'hidden')}
              >
                {section.lessons.map((lesson) => {
                  const active = lesson.id === currentLessonId;
                  const interactionLocked = readOnly || (lesson.locked && !lesson.completed);
                  return (
                    <li key={lesson.id}>
                      <button
                        type="button"
                        aria-disabled={interactionLocked}
                        aria-label={
                          interactionLocked
                            ? `${lesson.title}. ${
                                readOnly
                                  ? 'Материалы недоступны в текущем состоянии прохождения'
                                  : (lesson.lockReason ?? 'Урок пока недоступен')
                              }`
                            : lesson.title
                        }
                        onClick={() => {
                          if (!interactionLocked) onSelectLesson(lesson.id);
                        }}
                        title={
                          interactionLocked
                            ? `${lesson.title}. ${
                                readOnly
                                  ? 'Материалы недоступны в текущем состоянии прохождения'
                                  : (lesson.lockReason ?? 'Урок пока недоступен')
                              }`
                            : lesson.title
                        }
                        className={cn(
                          'group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition',
                          active &&
                            'bg-primary-50 font-semibold text-primary-800 ring-1 ring-inset ring-primary-100',
                          !active && !interactionLocked && 'text-slate-700 hover:bg-slate-100',
                          interactionLocked && 'cursor-not-allowed text-slate-400',
                        )}
                      >
                        {lesson.completed ? (
                          <Check
                            className="size-4 shrink-0 text-emerald-600"
                            strokeWidth={2.5}
                            aria-hidden
                          />
                        ) : interactionLocked ? (
                          <LockKeyhole className="size-3.5 shrink-0 text-slate-400" aria-hidden />
                        ) : active ? (
                          <PlayCircle className="size-4 shrink-0 text-primary-600" aria-hidden />
                        ) : (
                          <Circle className="size-3.5 shrink-0 text-slate-300" aria-hidden />
                        )}
                        <span className="line-clamp-2 min-w-0 flex-1 leading-5">
                          {lesson.title}
                        </span>
                        {lesson.hasQuiz ? (
                          <span
                            className={cn(
                              'shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                              active
                                ? 'bg-primary-100 text-primary-700'
                                : 'bg-slate-100 text-slate-500',
                            )}
                          >
                            тест
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function CoursePreviewPage() {
  const { versionId, draftVersionId } = useParams();
  const previewVersionId = versionId ?? draftVersionId ?? '';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const lessonFromUrl = searchParams.get('lesson') ?? undefined;
  const previewQuery = useQuery({
    queryKey: queryKeys.academyV2.draftOutline(previewVersionId),
    queryFn: ({ signal }) => academyVersionsApi.getLearner(previewVersionId, { signal }),
    enabled: Boolean(previewVersionId),
    retry: false,
  });
  const outline = previewQuery.data;
  const lessons = useMemo(
    () =>
      (outline?.sections ?? [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .flatMap((section) =>
          section.lessons
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((lesson) => ({ ...lesson, sectionId: section.id })),
        ),
    [outline],
  );

  useEffect(() => {
    if (!lessons[0]) return;
    if (lessonFromUrl && lessons.some((lesson) => lesson.id === lessonFromUrl)) return;
    setSearchParams({ lesson: lessons[0].id }, { replace: true });
  }, [lessonFromUrl, lessons, setSearchParams]);

  if (previewQuery.isError) {
    const status = previewQuery.error instanceof ApiError ? previewQuery.error.status : 0;
    return (
      <div className="flex min-h-screen items-center justify-center bg-page p-6">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-lg font-semibold text-slate-900">
            {status === 403 ? 'Предпросмотр недоступен' : 'Не удалось открыть предпросмотр'}
          </h1>
          <p className="text-sm text-slate-500">
            Проверьте права на версию курса или повторите попытку.
          </p>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Назад
          </Button>
        </div>
      </div>
    );
  }

  if (!outline) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page text-sm text-slate-500">
        Загружаем предпросмотр…
      </div>
    );
  }

  const selected = lessons.find((lesson) => lesson.id === lessonFromUrl) ?? lessons[0];
  const selectedLesson: LessonLearner | undefined = selected
    ? {
        id: selected.id,
        courseId: outline.courseId,
        sectionId: selected.sectionId,
        versionId: outline.id,
        title: selected.title,
        order: selected.order,
        content: selected.content ?? { type: 'doc', content: [] },
        quiz: selected.quiz,
        estimatedMinutes: selected.estimatedMinutes,
        locked: false,
        completed: false,
      }
    : undefined;

  return (
    <CoursePlayerShell
      mode="preview"
      title={outline.title}
      percent={0}
      headerLeft={
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">Назад</span>
        </Button>
      }
      headerMeta={
        <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">
          {draftVersionId
            ? 'Черновик · без сохранения прогресса'
            : 'Версия · без сохранения прогресса'}
        </span>
      }
      outline={{
        ...outline,
        sections: outline.sections.map((section) => ({
          ...section,
          lessons: section.lessons.map((lesson) => ({
            ...lesson,
            locked: false,
            completed: false,
          })),
        })),
      }}
      currentLessonId={selected?.id}
      onSelectLesson={(lessonId) => setSearchParams({ lesson: lessonId })}
      outlineToggleIcon={<PanelLeft className="size-4" />}
      callout={
        <AcademyStatusCallout
          tone="info"
          title="Режим предпросмотра"
          description="Завершение уроков, попытки тестов и прогресс в этом режиме не записываются."
        />
      }
      content={
        <div>
          <LessonArticle
            lesson={selectedLesson}
            sectionTitle={
              outline.sections.find((section) => section.id === selected?.sectionId)?.title
            }
            lessonNumber={
              selected ? lessons.findIndex((lesson) => lesson.id === selected.id) + 1 : undefined
            }
            totalLessons={lessons.length}
          />
          {selected && !selected.content ? (
            <div className="mx-auto max-w-3xl px-4 pb-4 sm:px-6">
              <AcademyStatusCallout
                tone="neutral"
                title="Содержимое урока пока недоступно"
                description="Программа версии загружена, но сервер не вернул безопасное содержимое выбранного урока для предпросмотра."
              />
            </div>
          ) : null}
          {selectedLesson?.quiz ? (
            <QuizRunner quiz={selectedLesson.quiz} disabled onSubmit={() => undefined} />
          ) : null}
        </div>
      }
    />
  );
}
