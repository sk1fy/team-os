import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, className, id: idProp, rows = 4, ...props },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        className={cn(
          'w-full resize-y rounded-md border bg-surface px-3 py-2 text-sm text-slate-900 transition-colors',
          'focus:outline-2 focus:-outline-offset-1',
          'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
          error
            ? 'border-danger-500 focus:outline-danger-500'
            : 'border-slate-300 focus:outline-primary-600',
        )}
        {...props}
      />
      {error && <p className="text-xs text-danger-600">{error}</p>}
    </div>
  );
});
