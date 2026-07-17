import { Link } from 'react-router-dom';
import { useTitle } from '@reactuses/core';
import { Button } from '@/components/ui';

export function NotFoundPage() {
  useTitle('Страница не найдена — TeamOS');
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface-muted p-4 text-center">
      <p className="text-6xl font-bold text-slate-300">404</p>
      <div>
        <h2>Страница не найдена</h2>
        <p className="mt-1 text-sm text-slate-500">
          Возможно, она была перемещена или никогда не существовала.
        </p>
      </div>
      <Link to="/">
        <Button variant="secondary">На главную</Button>
      </Link>
    </div>
  );
}
