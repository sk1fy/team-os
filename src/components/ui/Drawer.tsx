import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { preventDismissOnPopoverClick } from './dismissGuard';

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl' | 'employee' | 'employeeCenter';
  placement?: 'side' | 'center';
  bodyClassName?: string;
  footerClassName?: string;
}

const sizeClasses = {
  md: 'max-w-md',
  lg: 'max-w-xl',
  xl: 'max-w-3xl',
  employee: 'max-w-[468px]',
  employeeCenter: 'max-w-[960px]',
};

/** Выдвижная панель справа — для карточек сущностей с длинным контентом. */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  header,
  footer,
  size = 'md',
  placement = 'side',
  bodyClassName,
  footerClassName,
}: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-overlay-in fixed inset-0 z-40 bg-ink/35" />
        <Dialog.Content
          onPointerDownOutside={preventDismissOnPopoverClick}
          onInteractOutside={preventDismissOnPopoverClick}
          className={cn(
            placement === 'side'
              ? 'animate-drawer-in fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-surface shadow-[-8px_0_40px_rgba(10,19,20,0.18)]'
              : 'animate-modal-in fixed top-1/2 left-1/2 z-50 flex max-h-[88vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg bg-surface shadow-popover',
            sizeClasses[size],
          )}
        >
          {header ? (
            <>
              <Dialog.Title className="sr-only">{title}</Dialog.Title>
              {description && <Dialog.Description className="sr-only">{description}</Dialog.Description>}
              {header}
            </>
          ) : (
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
              <div>
                <Dialog.Title className="text-base font-semibold text-slate-900">
                  {title}
                </Dialog.Title>
                {description && (
                  <Dialog.Description className="mt-1 text-sm text-slate-500">
                    {description}
                  </Dialog.Description>
                )}
              </div>
              <Dialog.Close
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="Закрыть"
              >
                <X className="size-5" />
              </Dialog.Close>
            </div>
          )}
          <div className={cn('flex-1 overflow-y-auto px-6 py-4', bodyClassName)}>{children}</div>
          {footer && (
            <div className={cn('flex justify-end gap-3 border-t border-slate-200 px-6 py-4', footerClassName)}>
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
