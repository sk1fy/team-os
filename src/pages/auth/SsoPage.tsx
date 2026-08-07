import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { authApi } from '@/api';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { safeHomePath } from '@/lib/permissions';
import { useAuthStore } from '@/stores/auth';
import { PublicAuthError } from './PublicAuthError';
import { publicAuthErrorView, type PublicAuthErrorView } from './publicAuthFlow';
import { claimOneTimeRequest, useOneTimeQueryToken } from './useOneTimeQueryToken';

export function SsoPage() {
  useTitle('Вход — TeamOS');
  const token = useOneTimeQueryToken();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const startedRef = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<PublicAuthErrorView>();

  useEffect(() => {
    if (!token) {
      setError(
        publicAuthErrorView(new ApiError('Ссылка недействительна', 400, { code: 'SSO_INVALID' })),
      );
      return;
    }
    if (!claimOneTimeRequest(startedRef)) return;
    setError(undefined);

    void authApi
      .exchangeSso(token)
      .then(async (session) => {
        useAuthStore.getState().setAccessToken(session.accessToken);
        useAuthStore.getState().setInitialized(true);
        queryClient.clear();
        queryClient.setQueryData(queryKeys.currentUser, session.user);

        let currentUser = session.user;
        try {
          currentUser = await authApi.getCurrentUser();
          queryClient.setQueryData(queryKeys.currentUser, currentUser);
        } catch {
          // Сессия уже выдана: ответ exchange остаётся безопасным fallback для перехода.
        }
        navigate(safeHomePath(currentUser.role, currentUser.sectionAccess), { replace: true });
      })
      .catch((caught: unknown) => setError(publicAuthErrorView(caught)));
  }, [attempt, navigate, queryClient, token]);

  if (error) {
    return (
      <PublicAuthError
        error={error}
        onRetry={
          error.action === 'retry'
            ? () => {
                startedRef.current = false;
                setAttempt((value) => value + 1);
              }
            : undefined
        }
      />
    );
  }

  return (
    <div
      className="w-full max-w-md rounded-xl border border-slate-200 bg-surface p-8 text-center shadow-card"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="mx-auto size-8 animate-spin rounded-full border-3 border-primary-100 border-t-primary-600" />
      <h1 className="mt-5 text-xl font-semibold text-slate-950">Входим в TeamOS…</h1>
      <p className="mt-2 text-sm text-slate-500">Это займёт всего несколько секунд.</p>
    </div>
  );
}
