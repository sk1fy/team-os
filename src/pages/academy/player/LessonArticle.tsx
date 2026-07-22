import { RichTextView } from '@/components/ui';
import type { LessonLearner } from '@/types/academy';
import { AcademyStatusCallout } from '../components/AcademyStatusCallout';

export function LessonArticle({
  lesson,
  loading,
}: {
  lesson?: LessonLearner | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6" aria-busy="true">
        <div className="h-8 w-2/3 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100" />
        <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <AcademyStatusCallout
          tone="neutral"
          title="Урок не выбран"
          description="Выберите урок в программе курса."
        />
      </div>
    );
  }

  if (lesson.locked) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <AcademyStatusCallout
          tone="warning"
          title="Урок пока недоступен"
          description="Пройдите предыдущие уроки, чтобы открыть этот материал."
        />
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{lesson.title}</h2>
        {lesson.estimatedMinutes != null ? (
          <p className="mt-1 text-sm text-slate-500">~{lesson.estimatedMinutes} мин</p>
        ) : null}
      </header>
      <RichTextView content={lesson.content} className="prose prose-slate max-w-none" />
    </article>
  );
}
