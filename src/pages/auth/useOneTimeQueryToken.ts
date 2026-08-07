import { useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export function withoutOneTimeToken(searchParams: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  next.delete('token');
  return next;
}

export function claimOneTimeRequest(ref: { current: boolean }): boolean {
  if (ref.current) return false;
  ref.current = true;
  return true;
}

/** Считывает одноразовый токен в память компонента и сразу удаляет его из URL. */
export function useOneTimeQueryToken(): string {
  const [searchParams, setSearchParams] = useSearchParams();
  const [token] = useState(() => searchParams.get('token')?.trim() ?? '');
  const clearedRef = useRef(false);

  useLayoutEffect(() => {
    if (clearedRef.current) return;
    clearedRef.current = true;
    if (!searchParams.has('token')) return;
    setSearchParams(withoutOneTimeToken(searchParams), { replace: true });
  }, [searchParams, setSearchParams]);

  return token;
}
