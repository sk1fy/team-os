import { Link, useParams } from 'react-router-dom';
import { useTitle } from '@reactuses/core';
import { academyRoutes } from '@/lib/academy';
import { Button } from '@/components/ui';

/**
 * Scaffold for two-pane Grok-style builder (Phase 3).
 * Fullscreen route outside AcademyLayout.
 */
export function CourseBuilderPage() {
  const { courseId = '' } = useParams();
  useTitle('Конструктор курса — Академия — TeamOS');

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-surface px-4">
        <div className="flex items-center gap-3">
          <Link to={academyRoutes.course(courseId)}>
            <Button variant="ghost" size="sm">
              Назад к курсу
            </Button>
          </Link>
          <h1 className="text-sm font-semibold text-slate-900">Конструктор (scaffold)</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled>
            Настройки
          </Button>
          <Button variant="secondary" size="sm" disabled>
            Предпросмотр
          </Button>
          <Button size="sm" disabled>
            Опубликовать
          </Button>
        </div>
      </header>
      <div className="grid flex-1 lg:grid-cols-[300px_1fr]">
        <aside className="border-r border-slate-200 bg-surface p-4 text-sm text-slate-500">
          Outline (dnd-kit, sections/lessons) — Phase 3
        </aside>
        <main className="p-6 text-sm text-slate-500">
          Редактор урока / теста (TipTap + Quiz builder) — Phase 3
        </main>
      </div>
    </div>
  );
}
