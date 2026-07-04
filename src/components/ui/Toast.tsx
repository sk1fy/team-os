import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useToastStore, type ToastVariant } from '@/stores/toast';
import { cn } from '@/lib/cn';

const icons: Record<ToastVariant, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  error: XCircle,
};

const iconClasses: Record<ToastVariant, string> = {
  info: 'text-primary-500',
  success: 'text-success-500',
  error: 'text-danger-500',
};

/** Рендерит стек тостов. Подключается один раз в корне приложения. */
export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 bottom-4 z-100 flex w-80 flex-col gap-2">
      {toasts.map((item) => {
        const Icon = icons[item.variant];
        return (
          <div
            key={item.id}
            role="status"
            className="animate-toast-in flex items-start gap-3 rounded-lg border border-slate-200 bg-surface p-3 shadow-popover"
          >
            <Icon className={cn('mt-0.5 size-5 shrink-0', iconClasses[item.variant])} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900">{item.title}</p>
              {item.description && (
                <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(item.id)}
              className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
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
