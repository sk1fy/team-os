import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Инспектор справа (`.insp` концепта, 620 px; на телефоне — весь экран):
 * шапка с подписью, вкладки, прокручиваемое тело и футер с действиями.
 */
export function InspectorDrawer({
  eyebrow,
  title,
  subtitle,
  tabs,
  footer,
  onClose,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  tabs?: ReactNode;
  footer: ReactNode;
  /** Закрытие крестиком, Esc или кликом мимо панели. */
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="animate-overlay-in fixed inset-0 z-40 bg-ink/35" />
        <Dialog.Content
          aria-describedby={undefined}
          onPointerDownOutside={(event) => {
            if (
              (event.target as HTMLElement | null)?.closest('[data-radix-popper-content-wrapper]')
            )
              event.preventDefault();
          }}
          className="animate-drawer-in fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-surface shadow-[-8px_0_40px_rgba(10,19,20,0.18)] sm:max-w-[620px]"
        >
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-[22px] py-5">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold tracking-[0.5px] text-slate-400 uppercase">
                {eyebrow}
              </div>
              <Dialog.Title className="mt-1 truncate text-lg font-semibold text-ink">
                {title}
              </Dialog.Title>
              {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
            </div>
            <Dialog.Close
              aria-label="Закрыть"
              className="grid size-9 shrink-0 place-items-center rounded-[9px] border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-ink"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>
          {tabs && <div className="border-b border-slate-200 px-[22px] py-3">{tabs}</div>}
          <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-[22px] py-5">
            {children}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-[22px] py-3.5">
            {footer}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Сегментированные вкладки (`.seg` концепта) с ролями tablist/tab. */
export function SegmentTabs<K extends string>({
  label,
  items,
  value,
  onChange,
  idPrefix,
}: {
  label: string;
  items: readonly { key: K; label: string; marker?: boolean }[];
  value: K;
  onChange: (key: K) => void;
  idPrefix: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-[10px] bg-slate-100 p-[3px]"
    >
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${item.key}`}
            aria-selected={active}
            aria-controls={`${idPrefix}-panel`}
            onClick={() => onChange(item.key)}
            className={
              'relative h-8 shrink-0 rounded-sm px-3 text-[13.5px] font-medium transition-colors ' +
              (active ? 'bg-surface text-ink shadow-sm' : 'text-slate-600 hover:text-ink')
            }
          >
            {item.label}
            {item.marker && (
              <span
                aria-hidden="true"
                className="absolute top-1.5 right-1 size-1.5 rounded-full bg-warning-500"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
