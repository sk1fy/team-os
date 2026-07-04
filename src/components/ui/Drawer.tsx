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
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  md: 'max-w-md',
  lg: 'max-w-xl',
  xl: 'max-w-3xl',
};

/** Выдвижная панель справа — для карточек сущностей с длинным контентом. */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
}: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-overlay-in fixed inset-0 z-40 bg-ink/35" />
        <Dialog.Content
          onPointerDownOutside={preventDismissOnPopoverClick}
          onInteractOutside={preventDismissOnPopoverClick}
          className={cn(
            'animate-drawer-in fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-surface shadow-[-8px_0_40px_rgba(10,19,20,0.18)]',
            sizeClasses[size],
          )}
        >
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
          <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
          {footer && (
            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
