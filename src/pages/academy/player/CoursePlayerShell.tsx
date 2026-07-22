import { useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { CourseVersionLearnerDetail } from '@/types/academy';
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
  outlineToggleIcon,
  callout,
  content,
  footer,
}: CoursePlayerShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  const outlinePanel = (
    <CourseOutlinePanel
      outline={outline}
      currentLessonId={currentLessonId}
      onSelectLesson={(id) => {
        onSelectLesson(id);
        setMobileOpen(false);
      }}
    />
  );

  return (
    <div className="flex min-h-screen flex-col bg-page" data-player-mode={mode}>
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-surface/95 px-3 backdrop-blur sm:px-4">
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
          <h1 className="truncate text-sm font-semibold text-slate-900 sm:text-base">{title}</h1>
          <div className="mt-0.5 flex items-center gap-2">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 sm:w-32">
              <div
                className="h-full rounded-full bg-primary-500"
                style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
              />
            </div>
            <span className="text-xs text-slate-500">{percent}%</span>
          </div>
        </div>
        {headerMeta}
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
          {callout ? <div className="border-b border-slate-100 px-4 py-3 sm:px-6">{callout}</div> : null}
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
}: {
  outline: CourseVersionLearnerDetail;
  currentLessonId?: string;
  onSelectLesson: (lessonId: string) => void;
}) {
  return (
    <nav className="p-3" aria-label="Программа курса">
      <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {outline.title}
      </p>
      <ul className="space-y-3">
        {outline.sections.map((section) => (
          <li key={section.id}>
            <p className="px-2 text-xs font-semibold text-slate-500">{section.title}</p>
            <ul className="mt-1 space-y-0.5">
              {section.lessons.map((lesson) => {
                const active = lesson.id === currentLessonId;
                return (
                  <li key={lesson.id}>
                    <button
                      type="button"
                      disabled={lesson.locked}
                      onClick={() => onSelectLesson(lesson.id)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition',
                        active && 'bg-primary-50 font-medium text-primary-800',
                        !active && !lesson.locked && 'text-slate-700 hover:bg-slate-100',
                        lesson.locked && 'cursor-not-allowed text-slate-400',
                      )}
                    >
                      <span
                        className={cn(
                          'size-1.5 shrink-0 rounded-full',
                          lesson.completed
                            ? 'bg-emerald-500'
                            : active
                              ? 'bg-primary-500'
                              : 'bg-slate-300',
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                      {lesson.hasQuiz ? (
                        <span className="text-[10px] font-medium uppercase text-slate-400">
                          тест
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function CoursePreviewPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-page p-6 text-sm text-slate-500">
      Preview player scaffold — Phase 3 (shared CoursePlayerShell, no writes).
    </div>
  );
}
