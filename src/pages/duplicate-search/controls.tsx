import type { ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Input, MultiSelect } from '@/components/ui';
import { cn } from '@/lib/cn';
import type {
  DuplicateFieldClause,
  DuplicateResourceOption,
  JoinCondition,
} from '@/api/rakurs/duplicates';

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-lg border border-slate-200 bg-surface shadow-card', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Toggle({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn('flex items-start gap-3', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative mt-0.5 h-5.5 w-10 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600',
          checked ? 'bg-primary-600' : 'bg-slate-300',
          disabled && 'opacity-50',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-4.5 rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </button>
      <span>
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-slate-500">{description}</span>}
      </span>
    </label>
  );
}

export function CheckField({
  checked,
  onCheckedChange,
  label,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className="size-4 rounded border-slate-300 accent-primary-600"
      />
      {label}
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex rounded-md bg-surface-sunken p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-sm px-3 py-1.5 text-xs font-semibold transition-colors',
            value === option.value
              ? 'bg-surface text-primary-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function FieldClausesEditor({
  clauses,
  options,
  onChange,
  allowAdd = true,
  minRows = 1,
  optionFilter,
}: {
  clauses: DuplicateFieldClause[];
  options: DuplicateResourceOption[];
  onChange: (clauses: DuplicateFieldClause[]) => void;
  allowAdd?: boolean;
  minRows?: number;
  optionFilter?: (option: DuplicateResourceOption) => boolean;
}) {
  const available = optionFilter ? options.filter(optionFilter) : options;
  const update = (index: number, patch: Partial<DuplicateFieldClause>) =>
    onChange(
      clauses.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );

  return (
    <div className="space-y-3">
      {clauses.map((clause, index) => (
        <div
          key={index}
          className="grid items-end gap-3 rounded-md border border-slate-100 bg-surface-sunken/50 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(180px,0.45fr)_auto_auto]"
        >
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">Поля</span>
            <MultiSelect
              options={available}
              values={clause.fields}
              onValuesChange={(fields) => update(index, { fields })}
              placeholder={clause.placeholder ?? 'Выберите поля'}
              formatCount={(count) => `Выбрано полей: ${count}`}
            />
          </div>
          <Input
            label="Игнорировать подстроку"
            value={clause.ignore}
            onChange={(event) => update(index, { ignore: event.target.value })}
            placeholder="Например, +7"
          />
          <Segmented<JoinCondition>
            value={clause.condition}
            onChange={(condition) => update(index, { condition })}
            ariaLabel={`Условие строки ${index + 1}`}
            options={[
              { value: 'or', label: 'ИЛИ' },
              { value: 'and', label: 'И' },
            ]}
          />
          {clauses.length > minRows && (
            <Button
              variant="ghost"
              size="sm"
              aria-label="Удалить условие"
              className="text-danger-600"
              onClick={() => onChange(clauses.filter((_, itemIndex) => itemIndex !== index))}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      ))}
      {allowAdd && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onChange([...clauses, { fields: [], ignore: '', condition: 'or' }])}
        >
          <Plus className="size-4" />
          Добавить условие
        </Button>
      )}
    </div>
  );
}
