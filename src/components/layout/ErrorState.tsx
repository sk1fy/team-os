import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui';

export function ErrorState({
  title = 'Не удалось загрузить данные',
  description = 'Проверьте соединение и попробуйте ещё раз.',
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-lg border border-danger-100 bg-danger-50 p-6 text-center">
      <AlertTriangle className="mx-auto size-8 text-danger-600" />
      <h2 className="mt-3 text-base font-semibold text-danger-700">{title}</h2>
      <p className="mt-1 text-sm text-danger-700/80">{description}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Повторить
        </Button>
      )}
    </div>
  );
}
