import { useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export function withoutOneTimeToken(
  searchParams: URLSearchParams,
  parameterName = 'token',
): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  next.delete(parameterName);
  return next;
}

export function claimOneTimeRequest(ref: { current: boolean }): boolean {
  if (ref.current) return false;
  ref.current = true;
  return true;
}

/** Считывает одноразовый токен в память компонента и сразу удаляет его из URL. */
export function useOneTimeQueryValue(parameterName = 'token'): {
  value: string;
  present: boolean;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const [captured] = useState(() => ({
    value: searchParams.get(parameterName)?.trim() ?? '',
    present: searchParams.has(parameterName),
  }));
  const clearedRef = useRef(false);

  useLayoutEffect(() => {
    if (clearedRef.current) return;
    clearedRef.current = true;
    if (!searchParams.has(parameterName)) return;
    setSearchParams(withoutOneTimeToken(searchParams, parameterName), { replace: true });
  }, [parameterName, searchParams, setSearchParams]);

  return captured;
}

export function useOneTimeQueryToken(parameterName = 'token'): string {
  return useOneTimeQueryValue(parameterName).value;
}
