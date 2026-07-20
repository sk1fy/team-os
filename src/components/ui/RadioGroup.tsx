import { cn } from '@/lib/cn';

export interface RadioOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  options: RadioOption[];
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function RadioGroup({
  options,
  value,
  onValueChange,
  label,
  disabled,
  className,
}: RadioGroupProps) {
  return (
    <fieldset className={className} disabled={disabled}>
      {label && <legend className="mb-1.5 text-xs font-semibold text-slate-700">{label}</legend>}
      <div className="inline-flex flex-wrap gap-1 rounded-md bg-surface-sunken p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            disabled={disabled || option.disabled}
            onClick={() => onValueChange(option.value)}
            className={cn(
              'rounded-[9px] px-3 py-1.5 text-sm font-semibold transition-colors',
              'focus-visible:outline-2 focus-visible:outline-primary-600 disabled:cursor-not-allowed disabled:text-slate-300',
              value === option.value
                ? 'bg-surface text-primary-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
