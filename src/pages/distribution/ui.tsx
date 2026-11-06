/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';
import { fullName } from '@/lib/labels';
import type { User } from '@/types';

/** Карточка концепта: `.card`. */
export const cardClass = 'rounded-xl border border-slate-200 bg-surface shadow-card';

/** Контейнер страницы как `.page` концепта. */
export const pageClass = 'max-w-[1360px] space-y-4 px-4 pt-5 pb-14 sm:px-6';

/** Карточка с заголовком (`card(title, body, extra)` в концепте). */
export function Card({
  title,
  description,
  extra,
  children,
  className,
  bodyClassName,
  label,
}: {
  title?: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Имя области для вспомогательных технологий (делает карточку регионом). */
  label?: string;
}) {
  return (
    <section aria-label={label} className={cn(cardClass, 'min-w-0', className)}>
      {(title || extra) && (
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-[18px]">
          <div className="min-w-0 flex-1">
            {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-1 text-[13px] text-slate-500">{description}</p>}
          </div>
          {extra}
        </div>
      )}
      <div className={cn('px-5 py-[18px]', bodyClassName)}>{children}</div>
    </section>
  );
}

/** Подзаголовок секции (`.sect-t`). */
export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3
      className={cn('text-xs font-semibold tracking-[0.5px] text-slate-500 uppercase', className)}
    >
      {children}
    </h3>
  );
}

/** Карточка показателя (`.kpi`). Рендерится внутри `<dl>`. */
export function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'warn';
}) {
  return (
    <div className={cn(cardClass, 'min-w-0 px-[18px] py-4 max-sm:px-3.5 max-sm:py-3')}>
      <dt className="text-[13px] text-slate-500">{label}</dt>
      <dd
        className={cn(
          'mt-1.5 text-[26px] leading-8 font-semibold tracking-[-0.6px]',
          tone === 'warn' ? 'text-warning-700 dark:text-amber-300' : 'text-ink',
        )}
      >
        {value}
      </dd>
      {hint && <dd className="mt-0.5 text-xs text-slate-500">{hint}</dd>}
    </div>
  );
}

export type PillTone = 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'brand';

const pillTones: Record<PillTone, string> = {
  neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200',
  green: 'bg-success-50 text-success-700 dark:bg-success-600/20 dark:text-green-300',
  amber: 'bg-warning-50 text-warning-700 dark:bg-warning-600/20 dark:text-amber-300',
  red: 'bg-danger-50 text-danger-700 dark:bg-danger-600/20 dark:text-red-300',
  blue: 'bg-sky-50 text-sky-700 dark:bg-sky-600/20 dark:text-sky-300',
  brand: 'bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-200',
};

/** Пилюля статуса (`.pill`). */
export function Pill({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: PillTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] shrink-0 items-center gap-1 rounded-[6px] px-2 text-xs font-medium whitespace-nowrap',
        pillTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Плашка проблемы (`problem()` в концепте): жёлтая, с причиной и
 * необязательной кнопкой решения справа.
 */
export function Problem({
  children,
  action,
  role = 'status',
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  /** `false` — без живой области (статичная подсказка). */
  role?: 'status' | 'alert' | false;
  className?: string;
}) {
  return (
    <div
      role={role || undefined}
      className={cn(
        'flex flex-wrap items-start gap-x-3 gap-y-2 rounded-[10px] bg-warning-50 px-3.5 py-3 text-[13.5px] text-amber-900 dark:bg-warning-600/15 dark:text-amber-200',
        className,
      )}
    >
      <TriangleAlert
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-warning-700 dark:text-amber-300"
      />
      <div className="min-w-0 flex-1 basis-48">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Сегмент-переключатель (`.seg`). */
export const segClass =
  'inline-flex max-w-full gap-0.5 overflow-x-auto rounded-[10px] bg-slate-100 p-[3px] [scrollbar-width:none] dark:bg-slate-800';

export function segButtonClass(active: boolean) {
  return cn(
    'inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-sm px-3 text-[13.5px] font-medium whitespace-nowrap transition-colors',
    'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-600',
    active ? 'bg-surface text-ink shadow-sm' : 'text-slate-600 hover:text-ink dark:text-slate-300',
  );
}

/** Список «подпись — значение» (`.dl`). */
export function DefinitionList({
  items,
  className,
}: {
  items: [ReactNode, ReactNode][];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        'grid grid-cols-[110px_minmax(0,1fr)] gap-x-3.5 gap-y-2.5 text-[13.5px] sm:grid-cols-[150px_minmax(0,1fr)]',
        className,
      )}
    >
      {items.map(([term, value], index) => (
        <div key={index} className="contents">
          <dt className="text-slate-500">{term}</dt>
          <dd className="min-w-0 break-words text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

// Палитра с контрастом белого текста не ниже 4.5:1.
const avatarColors = [
  'bg-[#2c746f]',
  'bg-[#2563eb]',
  'bg-[#7c3aed]',
  'bg-[#be185d]',
  'bg-[#0e7490]',
  'bg-[#b45309]',
  'bg-[#4d7c0f]',
  'bg-[#b91c1c]',
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');
}

function colorFor(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

/** Декоративный аватар сотрудника (инициалы). */
export function PersonAvatar({
  name,
  seed,
  size = 'sm',
  className,
}: {
  name: string;
  seed?: string;
  size?: 'xs' | 'sm';
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full font-semibold text-white select-none',
        size === 'xs' ? 'size-6 text-[10px]' : 'size-8 text-xs',
        colorFor(seed ?? name),
        className,
      )}
    >
      {initials(name) || '?'}
    </span>
  );
}

/** Стопка аватаров участников (`.avs`). */
export function AvatarStack({
  ids,
  users,
  max = 5,
}: {
  ids: string[];
  users: User[];
  max?: number;
}) {
  const shown = ids.slice(0, max);
  const rest = ids.length - shown.length;
  return (
    <span className="flex items-center" aria-hidden="true">
      {shown.map((id, index) => {
        const user = users.find((u) => u.id === id);
        return (
          <PersonAvatar
            key={id}
            name={user ? fullName(user) : 'Сотрудник'}
            seed={id}
            size="xs"
            className={cn('border-2 border-surface', index > 0 && '-ml-1.5')}
          />
        );
      })}
      {rest > 0 && (
        <span className="-ml-1.5 inline-grid size-6 place-items-center rounded-full border-2 border-surface bg-slate-100 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
          +{rest}
        </span>
      )}
    </span>
  );
}

/** Строка списка (`.list-row`) с иконкой в квадрате (`.ico-box`). */
export function iconBoxClass(tone: 'neutral' | 'red' | 'amber' | 'brand' | 'green' = 'neutral') {
  return cn(
    'grid size-[34px] shrink-0 place-items-center rounded-[9px]',
    tone === 'red'
      ? 'bg-danger-50 text-danger-700 dark:bg-danger-600/20 dark:text-red-300'
      : tone === 'amber'
        ? 'bg-warning-50 text-warning-700 dark:bg-warning-600/20 dark:text-amber-300'
        : tone === 'brand'
          ? 'bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-200'
          : tone === 'green'
            ? 'bg-success-50 text-success-700 dark:bg-success-600/20 dark:text-green-300'
            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  );
}
