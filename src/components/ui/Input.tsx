import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, className, id: idProp, ...props },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-xs font-semibold text-slate-700">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        className={cn(
          'h-9.5 w-full rounded-md border bg-surface px-3 text-sm text-slate-900 transition-colors',
          'focus:outline-2 focus:-outline-offset-1',
          'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
          error
            ? 'border-danger-500 focus:outline-danger-500'
            : 'border-slate-200 focus:outline-primary-600',
        )}
        {...props}
      />
      {error ? (
        <p className="text-xs text-danger-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
});
