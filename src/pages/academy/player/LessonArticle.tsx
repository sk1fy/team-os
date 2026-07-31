import { useMemo, useRef, type ReactNode } from 'react';
import { CheckCircle2, Clock3, FileText, List } from 'lucide-react';
import { parseLessonBlocks } from '@/lib/academy/lessonBlocks';
import type { LessonLearner } from '@/types/academy';
import { AcademyStatusCallout } from '../components/AcademyStatusCallout';
import { LessonBlocksView } from './LessonBlocksView';

interface RichTextNode {
  type?: string;
  attrs?: { level?: number };
  text?: string;
  content?: RichTextNode[];
}

function nodeText(node: RichTextNode): string {
  if (node.text) return node.text;
  return (node.content ?? []).map(nodeText).join('');
}

function lessonHeadings(content: LessonLearner['content']): string[] {
  const result: string[] = [];
  const visit = (nodes: RichTextNode[] | undefined) => {
    for (const node of nodes ?? []) {
      if (node.type === 'heading' && (node.attrs?.level === 2 || node.attrs?.level === 3)) {
        const label = nodeText(node).trim();
        if (label) result.push(label);
      }
      visit(node.content);
    }
  };
  visit(content.content as RichTextNode[] | undefined);
  return result.slice(0, 7);
}

function hasVideo(content: LessonLearner['content']): boolean {
  let found = false;
  const visit = (nodes: RichTextNode[] | undefined) => {
    for (const node of nodes ?? []) {
      if (node.type === 'youtube' || node.type === 'videoEmbed') found = true;
      if (!found) visit(node.content);
    }
  };
  visit(content.content as RichTextNode[] | undefined);
  return found;
}

export function LessonArticle({
  lesson,
  loading,
  sectionTitle,
  lessonNumber,
  totalLessons,
  quizContent,
}: {
  lesson?: LessonLearner | null;
  loading?: boolean;
  sectionTitle?: string;
  lessonNumber?: number;
  totalLessons?: number;
  quizContent?: ReactNode;
}) {
  const articleRef = useRef<HTMLElement>(null);
  const headings = useMemo(() => (lesson ? lessonHeadings(lesson.content) : []), [lesson]);
  const includesVideo = useMemo(() => (lesson ? hasVideo(lesson.content) : false), [lesson]);
  const blocks = useMemo(
    () => parseLessonBlocks(lesson?.content, Boolean(quizContent)),
    [lesson?.content, quizContent],
  );

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
    <article ref={articleRef} className="mx-auto max-w-4xl px-4 py-7 sm:px-8 sm:py-10">
      <header className="border-b border-slate-200 pb-7">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
          {sectionTitle ? <span className="text-primary-700">{sectionTitle}</span> : null}
          {sectionTitle && lessonNumber ? <span aria-hidden>·</span> : null}
          {lessonNumber ? (
            <span>
              Урок {lessonNumber}
              {totalLessons ? ` из ${totalLessons}` : ''}
            </span>
          ) : null}
          {lesson.completed ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">
              <CheckCircle2 className="size-3.5" aria-hidden />
              Пройден
            </span>
          ) : null}
        </div>
        <h2 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-[-0.025em] text-slate-950 sm:text-4xl">
          {lesson.title}
        </h2>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            <FileText className="size-3.5" aria-hidden />
            {includesVideo ? 'Видео и материал' : lesson.quiz ? 'Материал и тест' : 'Материал'}
          </span>
          {lesson.estimatedMinutes != null ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              <Clock3 className="size-3.5" aria-hidden />
              {lesson.estimatedMinutes} мин
            </span>
          ) : null}
        </div>
      </header>

      {headings.length > 1 ? (
        <nav
          className="sticky top-16 z-10 -mx-4 overflow-x-auto border-b border-slate-200 bg-page/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8"
          aria-label="Содержание урока"
        >
          <div className="flex min-w-max items-center gap-1.5">
            <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <List className="size-3.5" aria-hidden />В уроке
            </span>
            {headings.map((heading, index) => (
              <button
                key={`${heading}-${index}`}
                type="button"
                className="rounded-full border border-slate-200 bg-surface px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-primary-200 hover:text-primary-700"
                onClick={() => {
                  const target = articleRef.current?.querySelectorAll(
                    '.rich-text h2, .rich-text h3',
                  )[index];
                  target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                {heading}
              </button>
            ))}
          </div>
        </nav>
      ) : null}

      <div className="mt-7 sm:mt-9">
        <LessonBlocksView blocks={blocks} quizContent={quizContent} />
      </div>
    </article>
  );
}
