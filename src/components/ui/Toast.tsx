import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useToastStore, type ToastVariant } from '@/stores/toast';
import { cn } from '@/lib/cn';

const icons: Record<ToastVariant, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  error: XCircle,
};

const iconClasses: Record<ToastVariant, string> = {
  info: 'text-primary-400',
  success: 'text-primary-400',
  error: 'text-danger-500',
};

/** Рендерит стек тостов — тёмные пилюли внизу по центру, как в дизайн-системе. */
export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-100 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((item) => {
        const Icon = icons[item.variant];
        return (
          <div
            key={item.id}
            role="status"
            className="animate-toast-in flex items-center gap-3 rounded-md bg-ink py-3 pr-3 pl-5 text-white shadow-popover"
          >
            <Icon className={cn('size-4.5 shrink-0', iconClasses[item.variant])} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{item.title}</p>
              {item.description && <p className="mt-0.5 text-xs text-white/60">{item.description}</p>}
            </div>
            <button
              onClick={() => dismiss(item.id)}
              className="shrink-0 rounded p-0.5 text-white/50 transition-colors hover:text-white"
              aria-label="Закрыть уведомление"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
