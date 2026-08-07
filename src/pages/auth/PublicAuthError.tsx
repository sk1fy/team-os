import { Link } from 'react-router-dom';
import { Button } from '@/components/ui';
import type { PublicAuthErrorView } from './publicAuthFlow';

export function PublicAuthError({
  error,
  onRetry,
}: {
  error: PublicAuthErrorView;
  onRetry?: () => void;
}) {
  return (
    <div className="w-full max-w-md rounded-xl border border-slate-200 bg-surface p-8 text-center shadow-card">
      <h1 className="text-xl font-semibold text-slate-950">{error.title}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">{error.description}</p>
      {error.action === 'retry' && onRetry ? (
        <Button className="mt-6" onClick={onRetry}>
          Повторить
        </Button>
      ) : null}
      {error.action === 'login' ? (
        <Link
          to="/auth/login"
          className="mt-6 inline-flex text-sm font-semibold text-primary-600 hover:underline"
        >
          Войти по email
        </Link>
      ) : null}
    </div>
  );
}
