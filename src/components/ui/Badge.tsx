import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type BadgeVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200',
  primary: 'bg-primary-50 text-primary-600 dark:bg-primary-900 dark:text-primary-200',
  success: 'bg-success-50 text-success-700 dark:bg-success-600/20 dark:text-green-300',
  warning: 'bg-warning-50 text-warning-700 dark:bg-warning-600/20 dark:text-amber-300',
  danger: 'bg-danger-50 text-danger-600 dark:bg-danger-600/20 dark:text-red-300',
};

export function Badge({ variant = 'neutral', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
