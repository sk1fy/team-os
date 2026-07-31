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
  {
    icon: typeof Info;
    card: string;
    outline: string;
    accent: string;
    iconStyle: string;
    accentIcon: string;
  }
> = {
  info: {
    icon: Info,
    card: 'border-sky-200 bg-sky-50/70',
    outline: 'border-sky-300 bg-surface',
    accent: 'border-sky-700 bg-sky-700 text-white',
    iconStyle: 'bg-sky-100 text-sky-700',
    accentIcon: 'bg-white/15 text-white',
  },
  warning: {
    icon: AlertTriangle,
    card: 'border-amber-200 bg-amber-50/70',
    outline: 'border-amber-300 bg-surface',
    accent: 'border-amber-300 bg-amber-100 text-amber-950',
    iconStyle: 'bg-amber-100 text-amber-700',
    accentIcon: 'bg-amber-200 text-amber-800',
  },
  success: {
    icon: CheckCircle2,
    card: 'border-emerald-200 bg-emerald-50/70',
    outline: 'border-emerald-300 bg-surface',
    accent: 'border-emerald-700 bg-emerald-700 text-white',
    iconStyle: 'bg-emerald-100 text-emerald-700',
    accentIcon: 'bg-white/15 text-white',
  },
};

function CalloutBlock({ block }: { block: LessonCalloutBlock }) {
  const tone = calloutTone[block.tone];
  const Icon = tone.icon;
  const accent = block.style === 'accent';

  return (
    <aside
      className={cn(
        'p-5 sm:p-6',
        block.style === 'minimal' ? 'border-l-4 border-slate-300 py-2 pl-5' : 'rounded-2xl border',
        block.style === 'card' && tone.card,
        block.style === 'outline' && tone.outline,
        accent && tone.accent,
      )}
    >
      <div className="flex items-start gap-3.5">
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-xl',
            accent ? tone.accentIcon : tone.iconStyle,
          )}
        >
          <Icon className="size-4.5" aria-hidden />
        </span>
        <div className="min-w-0 pt-0.5">
          <h3 className={cn('text-base font-semibold', accent ? 'text-inherit' : 'text-slate-900')}>
            {block.title}
          </h3>
          <p
            className={cn(
              'mt-1.5 whitespace-pre-line text-sm leading-6',
              accent ? 'text-inherit opacity-80' : 'text-slate-600',
            )}
          >
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
        <section
          aria-labelledby={`${block.id}-title`}
          className={cn(
            block.style === 'accent' && 'rounded-2xl bg-slate-950 p-5 sm:p-6',
            block.style === 'outline' &&
              'rounded-2xl border-2 border-slate-300 bg-surface p-5 sm:p-6',
            block.style === 'minimal' && 'border-y border-slate-200 py-5',
          )}
        >
          <h3
            id={`${block.id}-title`}
            className={cn(
              'mb-3 text-xs font-semibold uppercase tracking-[0.12em]',
              block.style === 'accent' ? 'text-slate-300' : 'text-slate-500',
            )}
          >
            {block.eyebrow}
          </h3>
          <div className="space-y-3">
            {block.rows.map((row) => (
              <div
                key={row.id}
                className={cn(
                  'grid overflow-hidden sm:grid-cols-2',
                  block.style === 'card' && 'rounded-2xl border border-slate-200 bg-surface',
                  block.style === 'outline' && 'rounded-xl border border-slate-200',
                  block.style === 'accent' && 'rounded-xl border border-white/10 bg-white/5',
                  block.style === 'minimal' && 'border-b border-slate-100 last:border-b-0',
                )}
              >
                <div
                  className={cn(
                    'border-b p-5 sm:border-b-0 sm:border-r',
                    block.style === 'accent'
                      ? 'border-white/10 bg-rose-950/30'
                      : 'border-slate-200',
                  )}
                >
                  <p
                    className={cn(
                      'flex items-center gap-2 text-xs font-semibold uppercase tracking-wide',
                      block.style === 'accent' ? 'text-rose-300' : 'text-rose-700',
                    )}
                  >
                    <span className="flex size-5 items-center justify-center rounded-full bg-rose-50">
                      <X className="size-3.5" aria-hidden />
                    </span>
                    Избегать
                  </p>
                  <p
                    className={cn(
                      'mt-2 pl-7 text-sm leading-6',
                      block.style === 'accent' ? 'text-slate-300' : 'text-slate-600',
                    )}
                  >
                    {row.avoid}
                  </p>
                </div>
                <div className={cn('p-5', block.style === 'accent' && 'bg-emerald-950/25')}>
                  <p
                    className={cn(
                      'flex items-center gap-2 text-xs font-semibold uppercase tracking-wide',
                      block.style === 'accent' ? 'text-emerald-300' : 'text-emerald-700',
                    )}
                  >
                    <span className="flex size-5 items-center justify-center rounded-full bg-emerald-50">
                      <Check className="size-3.5" aria-hidden />
                    </span>
                    Предпочитать
                  </p>
                  <p
                    className={cn(
                      'mt-2 pl-7 text-sm leading-6',
                      block.style === 'accent' ? 'text-white' : 'text-slate-700',
                    )}
                  >
                    {row.prefer}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      );

    case 'takeaway':
      return (
        <aside
          className={cn(
            'relative overflow-hidden p-6 sm:p-7',
            block.style === 'card' &&
              'rounded-2xl border border-primary-100 bg-primary-50 text-slate-950',
            block.style === 'accent' && 'rounded-2xl bg-primary-700 text-white',
            block.style === 'outline' &&
              'rounded-2xl border-2 border-primary-300 bg-surface text-slate-950',
            block.style === 'minimal' && 'border-l-4 border-primary-500 py-3 pl-5 text-slate-950',
          )}
        >
          <Lightbulb
            className={cn(
              'absolute -right-3 -top-4 size-24 rotate-12',
              block.style === 'accent' ? 'text-white/10' : 'text-primary-500/10',
            )}
            aria-hidden
          />
          <div className="relative">
            <span
              className={cn(
                'flex size-9 items-center justify-center rounded-xl',
                block.style === 'accent'
                  ? 'bg-white/15 text-white'
                  : 'bg-primary-100 text-primary-700',
              )}
            >
              <Lightbulb className="size-4.5" aria-hidden />
            </span>
            <h3
              className={cn(
                'mt-4 text-lg font-semibold',
                block.style === 'accent' ? 'text-white' : 'text-slate-950',
              )}
            >
              {block.title}
            </h3>
            <p
              className={cn(
                'mt-2 max-w-2xl whitespace-pre-line text-sm leading-6',
                block.style === 'accent' ? 'text-white/85' : 'text-slate-600',
              )}
            >
              {block.body}
            </p>
          </div>
        </aside>
      );

    case 'steps':
      return (
        <section
          aria-labelledby={`${block.id}-title`}
          className={cn(
            'p-5 sm:p-7',
            block.style === 'card' && 'rounded-2xl border border-slate-200 bg-surface shadow-sm',
            block.style === 'accent' && 'rounded-2xl border border-indigo-200 bg-indigo-50',
            block.style === 'outline' &&
              'rounded-2xl border-2 border-dashed border-indigo-300 bg-surface',
            block.style === 'minimal' && 'border-l-2 border-indigo-300 py-2 pl-5',
          )}
        >
          <h3 id={`${block.id}-title`} className="text-lg font-semibold text-slate-900">
            {block.title}
          </h3>
          <ol className="mt-5 space-y-4">
            {block.items.map((item, index) => (
              <li key={item.id} className="flex items-start gap-3.5">
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center text-sm font-semibold',
                    block.style === 'accent'
                      ? 'rounded-lg bg-indigo-600 text-white'
                      : block.style === 'minimal'
                        ? 'border-b-2 border-indigo-400 text-indigo-700'
                        : 'rounded-full bg-primary-50 text-primary-700',
                  )}
                >
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
          className={cn(
            'p-5 sm:p-7',
            block.style === 'card' && 'rounded-2xl border border-emerald-200 bg-emerald-50/40',
            block.style === 'accent' && 'rounded-2xl bg-emerald-700 text-white',
            block.style === 'outline' && 'rounded-2xl border-2 border-emerald-300 bg-surface',
            block.style === 'minimal' && 'border-y border-emerald-200 px-0',
          )}
        >
          <h3
            id={`${block.id}-title`}
            className={cn(
              'flex items-center gap-2.5 text-lg font-semibold',
              block.style === 'accent' ? 'text-white' : 'text-slate-900',
            )}
          >
            <CheckCircle2
              className={cn(
                'size-5',
                block.style === 'accent' ? 'text-emerald-200' : 'text-emerald-600',
              )}
              aria-hidden
            />
            {block.title}
          </h3>
          <ul className="mt-5 space-y-3">
            {block.items.map((item) => (
              <li
                key={item.id}
                className={cn(
                  'flex items-start gap-3 text-sm leading-6',
                  block.style === 'accent' ? 'text-emerald-50' : 'text-slate-700',
                )}
              >
                <Circle
                  className={cn(
                    'mt-1 size-4 shrink-0',
                    block.style === 'accent' ? 'text-emerald-200' : 'text-emerald-500',
                  )}
                  aria-hidden
                />
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
          className={cn(
            'overflow-hidden',
            block.style === 'card' && 'rounded-2xl border border-violet-200 bg-surface',
            block.style === 'accent' && 'rounded-2xl bg-violet-700 text-white',
            block.style === 'outline' && 'rounded-2xl border-2 border-violet-300 bg-surface',
            block.style === 'minimal' && 'border-l-4 border-violet-400',
          )}
        >
          <div
            className={cn(
              'flex items-center gap-3 px-5 py-4 sm:px-6',
              block.style === 'card' && 'border-b border-violet-100 bg-violet-50/70',
              block.style === 'accent' && 'border-b border-white/15',
              block.style === 'outline' && 'border-b border-violet-100',
              block.style === 'minimal' && 'py-2',
            )}
          >
            <span
              className={cn(
                'flex size-9 items-center justify-center rounded-xl',
                block.style === 'accent'
                  ? 'bg-white/15 text-white'
                  : 'bg-violet-100 text-violet-700',
              )}
            >
              <Sparkles className="size-4.5" aria-hidden />
            </span>
            <div>
              <p
                className={cn(
                  'text-xs font-semibold uppercase tracking-wide',
                  block.style === 'accent' ? 'text-violet-200' : 'text-violet-600',
                )}
              >
                Практика
              </p>
              <h3
                id={`${block.id}-title`}
                className={cn(
                  'text-base font-semibold',
                  block.style === 'accent' ? 'text-white' : 'text-slate-900',
                )}
              >
                {block.title}
              </h3>
            </div>
          </div>
          <div className="p-5 sm:p-6">
            <p
              className={cn(
                'whitespace-pre-line text-sm leading-6',
                block.style === 'accent' ? 'text-violet-100' : 'text-slate-600',
              )}
            >
              {block.description}
            </p>
            <div
              className={cn(
                'mt-4 rounded-xl border px-4 py-3.5',
                block.style === 'accent'
                  ? 'border-white/15 bg-white/10'
                  : 'border-violet-100 bg-violet-50/50',
              )}
            >
              <p
                className={cn(
                  'text-xs font-semibold uppercase tracking-wide',
                  block.style === 'accent' ? 'text-violet-200' : 'text-violet-600',
                )}
              >
                Что сделать
              </p>
              <p
                className={cn(
                  'mt-1 text-sm font-medium leading-6',
                  block.style === 'accent' ? 'text-white' : 'text-slate-800',
                )}
              >
                {block.action}
              </p>
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
