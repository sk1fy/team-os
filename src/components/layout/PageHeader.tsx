import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useChromeSlots } from './chromeSlots';

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** Кнопки действий справа. */
  actions?: ReactNode;
  /**
   * Рендерить на месте, а не в шапке каркаса. Нужно для вложенных страниц
   * и экранов вне основного каркаса.
   */
  inline?: boolean;
}

/**
 * Заголовок страницы. Внутри каркаса (`AppLayout`) заголовок и описание
 * показываются в шапке, а действия — справа в шапке.
 */
export function PageHeader({ title, description, actions, inline }: PageHeaderProps) {
  const slots = useChromeSlots();

  if (!inline && slots?.header) {
    return (
      <>
        {createPortal(
          <div className="min-w-0">
            <h1
              title={title}
              className="truncate text-[21px] leading-tight font-bold tracking-[-0.4px] text-ink max-md:text-[19px]"
            >
              {title}
            </h1>
            {description && (
              <p className="mt-0.5 line-clamp-2 max-w-[620px] text-[13px] text-slate-500 max-md:hidden">
                {description}
              </p>
            )}
          </div>,
          slots.header,
        )}
        {actions && slots.actions
          ? createPortal(
              <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>,
              slots.actions,
            )
          : null}
      </>
    );
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1>{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}
