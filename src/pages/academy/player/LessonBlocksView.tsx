import type { ReactNode } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Circle,
  Info,
  Lightbulb,
  Sparkles,
  X,
} from 'lucide-react';
import { RichTextView } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { LessonBlock, LessonCalloutBlock } from '@/lib/academy/lessonBlocks';

const calloutTone: Record<
  LessonCalloutBlock['tone'],
  { icon: typeof Info; frame: string; iconStyle: string }
> = {
  info: {
    icon: Info,
    frame: 'border-sky-200 bg-sky-50/70',
    iconStyle: 'bg-sky-100 text-sky-700',
  },
  warning: {
    icon: AlertTriangle,
    frame: 'border-amber-200 bg-amber-50/70',
    iconStyle: 'bg-amber-100 text-amber-700',
  },
  success: {
    icon: CheckCircle2,
    frame: 'border-emerald-200 bg-emerald-50/70',
    iconStyle: 'bg-emerald-100 text-emerald-700',
  },
};

function CalloutBlock({ block }: { block: LessonCalloutBlock }) {
  const tone = calloutTone[block.tone];
  const Icon = tone.icon;

  return (
    <aside className={cn('rounded-2xl border p-5 sm:p-6', tone.frame)}>
      <div className="flex items-start gap-3.5">
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-xl',
            tone.iconStyle,
          )}
        >
          <Icon className="size-4.5" aria-hidden />
        </span>
        <div className="min-w-0 pt-0.5">
          <h3 className="text-base font-semibold text-slate-900">{block.title}</h3>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-slate-600">
            {block.body}
          </p>
        </div>
      </div>
    </aside>
  );
}

function BlockView({ block, quizContent }: { block: LessonBlock; quizContent?: ReactNode }) {
  switch (block.kind) {
    case 'richText':
      return <RichTextView content={block.content} className="lesson-rich-text max-w-none" />;

    case 'callout':
      return <CalloutBlock block={block} />;

    case 'comparison':
      return (
        <section aria-labelledby={`${block.id}-title`}>
          <h3
            id={`${block.id}-title`}
            className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
          >
            {block.eyebrow}
          </h3>
          <div className="space-y-3">
            {block.rows.map((row) => (
              <div
                key={row.id}
                className="grid overflow-hidden rounded-2xl border border-slate-200 bg-surface sm:grid-cols-2"
              >
                <div className="border-b border-slate-200 p-5 sm:border-b-0 sm:border-r">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-rose-700">
                    <span className="flex size-5 items-center justify-center rounded-full bg-rose-50">
                      <X className="size-3.5" aria-hidden />
                    </span>
                    Избегать
                  </p>
                  <p className="mt-2 pl-7 text-sm leading-6 text-slate-600">{row.avoid}</p>
                </div>
                <div className="p-5">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    <span className="flex size-5 items-center justify-center rounded-full bg-emerald-50">
                      <Check className="size-3.5" aria-hidden />
                    </span>
                    Предпочитать
                  </p>
                  <p className="mt-2 pl-7 text-sm leading-6 text-slate-700">{row.prefer}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      );

    case 'takeaway':
      return (
        <aside className="relative overflow-hidden rounded-2xl bg-primary-700 p-6 text-white sm:p-7">
          <Lightbulb
            className="absolute -right-3 -top-4 size-24 rotate-12 text-white/10"
            aria-hidden
          />
          <div className="relative">
            <span className="flex size-9 items-center justify-center rounded-xl bg-white/15">
              <Lightbulb className="size-4.5" aria-hidden />
            </span>
            <h3 className="mt-4 text-lg font-semibold">{block.title}</h3>
            <p className="mt-2 max-w-2xl whitespace-pre-line text-sm leading-6 text-white/80">
              {block.body}
            </p>
          </div>
        </aside>
      );

    case 'steps':
      return (
        <section
          aria-labelledby={`${block.id}-title`}
          className="rounded-2xl border border-slate-200 bg-surface p-5 sm:p-7"
        >
          <h3 id={`${block.id}-title`} className="text-lg font-semibold text-slate-900">
            {block.title}
          </h3>
          <ol className="mt-5 space-y-4">
            {block.items.map((item, index) => (
              <li key={item.id} className="flex items-start gap-3.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-semibold text-primary-700">
                  {index + 1}
                </span>
                <p className="pt-1 text-sm leading-6 text-slate-700">{item.text}</p>
              </li>
            ))}
          </ol>
        </section>
      );

    case 'checklist':
      return (
        <section
          aria-labelledby={`${block.id}-title`}
          className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 sm:p-7"
        >
          <h3
            id={`${block.id}-title`}
            className="flex items-center gap-2.5 text-lg font-semibold text-slate-900"
          >
            <CheckCircle2 className="size-5 text-emerald-600" aria-hidden />
            {block.title}
          </h3>
          <ul className="mt-5 space-y-3">
            {block.items.map((item) => (
              <li key={item.id} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                <Circle className="mt-1 size-4 shrink-0 text-emerald-500" aria-hidden />
                {item.text}
              </li>
            ))}
          </ul>
        </section>
      );

    case 'practice':
      return (
        <section
          aria-labelledby={`${block.id}-title`}
          className="overflow-hidden rounded-2xl border border-violet-200 bg-surface"
        >
          <div className="flex items-center gap-3 border-b border-violet-100 bg-violet-50/70 px-5 py-4 sm:px-6">
            <span className="flex size-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
              <Sparkles className="size-4.5" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                Практика
              </p>
              <h3 id={`${block.id}-title`} className="text-base font-semibold text-slate-900">
                {block.title}
              </h3>
            </div>
          </div>
          <div className="p-5 sm:p-6">
            <p className="whitespace-pre-line text-sm leading-6 text-slate-600">
              {block.description}
            </p>
            <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50/50 px-4 py-3.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                Что сделать
              </p>
              <p className="mt-1 text-sm font-medium leading-6 text-slate-800">{block.action}</p>
            </div>
          </div>
        </section>
      );

    case 'quiz':
      return quizContent ?? null;
  }
}

export function LessonBlocksView({
  blocks,
  quizContent,
}: {
  blocks: LessonBlock[];
  quizContent?: ReactNode;
}) {
  const hasQuizMarker = blocks.some((block) => block.kind === 'quiz');
  const hasQuizContent = quizContent !== undefined && quizContent !== null;

  return (
    <div className="space-y-7 sm:space-y-9">
      {blocks.map((block) => (
        <BlockView key={block.id} block={block} quizContent={quizContent} />
      ))}
      {!hasQuizMarker && hasQuizContent ? quizContent : null}
    </div>
  );
}
