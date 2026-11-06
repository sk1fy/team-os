import { useEffect, useRef, type ReactNode } from 'react';
import { AlertTriangle, Check, Info, Search } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui';
import { cn } from '@/lib/cn';

/* Мелкие элементы концепта C для «Контроля задач»: карточка, плашки, пилюли, переключатели. */

export function Card({
  title,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('rounded-xl border border-slate-200 bg-surface shadow-card', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-[18px]">
          {title && <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>}
          {actions}
        </div>
      )}
      <div className={cn('px-5 pt-4 pb-5', bodyClassName)}>{children}</div>
    </section>
  );
}

/** Жёлтая плашка проблемы с причиной и действием (`problem()` концепта). */
export function Problem({
  title,
  children,
  action,
  role,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  role?: 'alert';
}) {
  return (
    <div
      role={role}
      className="flex flex-wrap items-start gap-3 rounded-[10px] bg-warning-50 px-3.5 py-3 text-[13.5px] text-[#7c3d0a] dark:bg-warning-600/20 dark:text-amber-200"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 basis-56">
        <b className="font-semibold">{title}</b>
        {children && <div className="mt-1 leading-normal">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

const noteTones = {
  neutral: 'bg-slate-100 text-slate-600',
  brand: 'bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-200',
  amber: 'bg-warning-50 text-[#7c3d0a] dark:bg-warning-600/20 dark:text-amber-200',
  red: 'bg-danger-50 text-danger-600 dark:bg-danger-600/20 dark:text-red-300',
  green: 'bg-success-50 text-success-700 dark:bg-success-600/20 dark:text-green-300',
} as const;

/** Пояснение или сообщение (`.note` концепта). */
export function Note({
  tone = 'neutral',
  icon,
  role,
  children,
  className,
}: {
  tone?: keyof typeof noteTones;
  icon?: ReactNode;
  role?: 'alert' | 'status';
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={role}
      className={cn(
        'flex gap-2.5 rounded-[10px] px-3.5 py-3 text-[13px] leading-normal',
        noteTones[tone],
        className,
      )}
    >
      <span className="mt-0.5 shrink-0" aria-hidden="true">
        {icon ?? <Info className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Пилюля `.pill`: 22 px, скругление 6 px. */
export function Pill({ className, ...props }: BadgeProps) {
  return <Badge className={cn('h-[22px] rounded-[6px] font-medium', className)} {...props} />;
}

const dotTones = {
  green: 'bg-success-600',
  amber: 'bg-warning-500',
  red: 'bg-danger-600',
  none: 'border-[1.5px] border-slate-400',
} as const;
export function StatusDot({ tone }: { tone: keyof typeof dotTones }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block size-2 shrink-0 rounded-full', dotTones[tone])}
    />
  );
}

/** Подпись к полю в редакторе (`.label` концепта). */
export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  const className = 'text-[13px] font-semibold text-slate-700';
  return htmlFor ? (
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
  ) : (
    <span className={className}>{children}</span>
  );
}

export const idNote = 'text-[11.5px] text-slate-400 tabular-nums';
export const linkButton =
  'cursor-pointer text-[13px] font-semibold text-primary-700 hover:underline disabled:cursor-not-allowed disabled:opacity-60 dark:text-primary-300';

/** Чекбокс с заголовком и пояснением (`.check` концепта). Имя поля — только заголовок. */
export function CheckRow({
  id,
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn('flex items-start gap-2.5 py-2.5', disabled && 'opacity-60')}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        aria-describedby={description ? `${id}-hint` : undefined}
        className="mt-px size-[17px] shrink-0 cursor-pointer accent-primary-600 disabled:cursor-not-allowed"
      />
      <div className="min-w-0 text-sm">
        <label htmlFor={id} className="block cursor-pointer font-[550] text-ink">
          {label}
        </label>
        {description && (
          <p id={`${id}-hint`} className="mt-0.5 text-[12.5px] text-slate-500">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

/** Нативный чекбокс с промежуточным состоянием. */
export function TriCheckbox({
  checked,
  indeterminate,
  onChange,
  disabled,
  ...aria
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  disabled?: boolean;
  'aria-label'?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate && !checked;
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      className="size-4 shrink-0 cursor-pointer accent-primary-600 disabled:cursor-not-allowed"
      {...aria}
    />
  );
}

/** Сегментный переключатель (`.seg sm`). */
export function Seg<K extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: K;
  options: { key: K; label: string; count?: number }[];
  onChange: (key: K) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex gap-0.5 rounded-[10px] bg-slate-100 p-[3px]"
    >
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={value === option.key}
          onClick={() => onChange(option.key)}
          className={cn(
            'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-[7px] px-2.5 text-[13px] font-medium transition-colors',
            value === option.key
              ? 'bg-surface text-ink shadow-sm'
              : 'text-slate-600 hover:text-ink',
          )}
        >
          {option.label}
          {option.count != null && (
            <span className="text-[11px] font-semibold text-slate-400">{option.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <label className="relative block min-w-[180px] flex-1">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="h-9 w-full rounded-md border border-slate-200 bg-surface pr-3 pl-9 text-sm text-ink focus:outline-2 focus:-outline-offset-1 focus:outline-primary-600"
      />
    </label>
  );
}

/** Плашка несохранённых правок (`.pubbar` концепта). Тёмная в обеих темах. */
export function Pubbar({
  children,
  onDiscard,
  onSave,
  saveLabel,
  busy,
  canSave,
  discardDisabled,
}: {
  children: ReactNode;
  onDiscard?: () => void;
  onSave: () => void;
  saveLabel: string;
  busy: boolean;
  canSave: boolean;
  discardDisabled?: boolean;
}) {
  return (
    <div
      role="region"
      aria-label="Несохранённые изменения"
      className="sticky bottom-4 z-20 mt-5 flex flex-wrap items-center gap-3 rounded-[14px] bg-[#151b26] py-2.5 dark:bg-[#222c3d] dark:ring-1 dark:ring-[#334155] pr-2.5 pl-[18px] text-sm text-slate-200 shadow-[0_12px_32px_#0f172a40] max-sm:px-3"
    >
      <span
        aria-hidden="true"
        className="size-2 shrink-0 rounded-full bg-[#f5b94a] shadow-[0_0_0_4px_#f5b94a33]"
      />
      <span className="min-w-0 flex-1 max-sm:basis-[calc(100%-30px)]">{children}</span>
      {onDiscard && (
        <button
          type="button"
          onClick={onDiscard}
          disabled={busy || discardDisabled}
          className="inline-flex h-[34px] cursor-pointer items-center rounded-[9px] border border-[#374151] px-3.5 text-[13.5px] font-semibold text-slate-300 hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-50 max-sm:flex-1 max-sm:justify-center"
        >
          Отменить
        </button>
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={!canSave}
        className="inline-flex h-[34px] cursor-pointer items-center gap-1.5 rounded-[9px] bg-[#4fae9f] px-3.5 text-[13.5px] font-semibold text-[#08201c] hover:bg-[#63c1b2] disabled:cursor-not-allowed disabled:opacity-60 max-sm:flex-1 max-sm:justify-center"
      >
        <Check className="size-4" aria-hidden="true" />
        {busy ? 'Сохраняем…' : saveLabel}
      </button>
    </div>
  );
}
