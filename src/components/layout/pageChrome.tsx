import { useMemo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  ChromeSlotsContext,
  sectionItemClass,
  useChromeSlots,
  type ChromeSlots,
} from './chromeSlots';

export function ChromeSlotsProvider({
  value,
  children,
}: {
  value: ChromeSlots;
  children: ReactNode;
}) {
  const { header, actions, sectionContext } = value;
  const memo = useMemo(
    () => ({ header, actions, sectionContext }),
    [header, actions, sectionContext],
  );
  return <ChromeSlotsContext.Provider value={memo}>{children}</ChromeSlotsContext.Provider>;
}

/**
 * Контент для панели раздела слева (под вкладками): фильтры по отделам,
 * разделы базы знаний и т. п. Вне каркаса ничего не рендерит.
 */
export function SectionContext({ children }: { children: ReactNode }) {
  const slots = useChromeSlots();
  if (!slots?.sectionContext) return null;
  return createPortal(children, slots.sectionContext);
}

/** Заголовок подгруппы в панели раздела («Отделы», «Разделы»). */
export function SectionContextHeading({ children }: { children: ReactNode }) {
  return (
    <div className="mx-2.5 mt-5 mb-1.5 text-[11px] font-semibold tracking-[0.5px] text-slate-400 uppercase">
      {children}
    </div>
  );
}

/** Пункт панели раздела: фильтр или действие. Выглядит как вкладка раздела. */
export function SectionContextItem({
  active,
  onClick,
  icon,
  count,
  disabled,
  title,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  icon?: ReactNode;
  count?: ReactNode;
  disabled?: boolean;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={sectionItemClass(Boolean(active), Boolean(disabled))}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate text-left">{children}</span>
      {count != null && (
        <span className="ml-auto shrink-0 text-xs font-medium text-slate-400">{count}</span>
      )}
    </button>
  );
}
