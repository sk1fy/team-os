import { Outlet } from 'react-router-dom';

/** Минимальный центрированный layout для страниц аутентификации. */
export function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-muted p-4">
      <div className="mb-8 flex items-center gap-2.5">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary-600 text-lg font-bold text-white">
          T
        </div>
        <span className="text-2xl font-bold text-slate-900">TeamOS</span>
      </div>
      <Outlet />
    </div>
  );
}
