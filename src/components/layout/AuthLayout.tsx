import { Outlet } from 'react-router-dom';
import { BrandMark } from './BrandMark';

/** Минимальный центрированный layout для страниц аутентификации. */
export function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-page p-4">
      <div className="mb-8 flex items-center gap-3">
        <BrandMark className="size-11 rounded-xl" />
        <div>
          <div className="text-2xl leading-tight font-bold tracking-tight text-ink">
            Team<span className="text-primary-600">OS</span>
          </div>
          <div className="text-xs text-slate-500">Управление командой</div>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
