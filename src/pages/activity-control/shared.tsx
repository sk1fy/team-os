import type { ReactNode } from 'react';
import { AlertTriangle, Info, RotateCcw } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import { errorMessage } from './model';

/** Подсказка (`.note` концепта): серая, фирменная или предупреждение. */
export function Note({
  tone = 'neutral',
  icon,
  className,
  children,
}: {
  tone?: 'neutral' | 'brand' | 'amber';
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex gap-2.5 rounded-[10px] px-3.5 py-3 text-[13px] leading-normal',
        tone === 'brand' &&
          'bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-100',
        tone === 'amber' &&
          'bg-warning-50 text-warning-700 dark:bg-warning-600/20 dark:text-amber-200',
        tone === 'neutral' && 'bg-slate-100 text-slate-600',
        className,
      )}
    >
      <span className="mt-px shrink-0 [&>svg]:size-4">{icon ?? <Info />}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Карточка (`.card` концепта) с заголовком и необязательным действием справа. */
export function Card({
  title,
  action,
  className,
  children,
}: {
  title?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn('rounded-xl border border-slate-200 bg-surface shadow-card', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-5 pt-[18px]">
          {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
          {action}
        </div>
      )}
      <div className="px-5 py-[18px]">{children}</div>
    </section>
  );
}

/** Строка «заголовок + пояснение + переключатель» (`.dd-row`). */
export function SettingRow({
  title,
  hint,
  control,
}: {
  title: ReactNode;
  hint?: ReactNode;
  control: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-ink">{title}</div>
        {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
      </div>
      {control}
    </div>
  );
}

export function Loading({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="flex items-center gap-2 py-6 text-sm text-slate-500">
      <span className="size-4 animate-spin rounded-full border-2 border-slate-200 border-t-primary-600" />
      {children}
    </p>
  );
}

/**
 * Ошибка запроса. 401 — предлагает войти снова (черновик не повторяется),
 * 403 — без повтора, остальное — с кнопкой «Повторить».
 */
export function Failure({
  error,
  reload,
  title = 'Не удалось загрузить данные',
}: {
  error: unknown;
  reload?: () => void;
  title?: string;
}) {
  const location = useLocation();
  if (error instanceof ApiError && error.status === 401)
    return (
      <div
        role="alert"
        className="flex gap-3 rounded-[10px] bg-warning-50 px-3.5 py-3 text-[13.5px] text-warning-700 dark:bg-warning-600/20 dark:text-amber-200"
      >
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            Сессия истекла. Скопируйте черновик перед повторным входом.
          </p>
          <Link
            className="mt-1 inline-block font-medium underline underline-offset-2"
            to="/auth/login"
            state={{ from: location }}
          >
            Войти снова
          </Link>
        </div>
      </div>
    );
  const retry = error instanceof ApiError && error.status === 403 ? undefined : reload;
  return (
    <div
      role="alert"
      className="flex flex-wrap items-start gap-3 rounded-[10px] bg-danger-50 px-3.5 py-3 text-[13.5px] text-danger-600 dark:bg-danger-600/20 dark:text-red-200"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5">{errorMessage(error)}</p>
      </div>
      {retry && (
        <Button size="sm" variant="secondary" onClick={retry}>
          <RotateCcw className="size-3.5" />
          Повторить
        </Button>
      )}
    </div>
  );
}
