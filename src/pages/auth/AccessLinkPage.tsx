import { queryKeys } from '@/api/queryKeys';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { LoaderCircle } from 'lucide-react';
import { authApi } from '@/api';

export function AccessLinkPage() {
  useTitle('Вход по ссылке — TeamOS');
  const { token } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    if (!token) {
      setFailed(true);
      return;
    }
    void authApi
      .loginWithAccessLink(token)
      .then((session) => {
        if (!active) return;
        queryClient.setQueryData(queryKeys.currentUser, session.user);
        navigate('/schedule', { replace: true });
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [navigate, queryClient, token]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-surface p-8 text-center shadow-card">
        {failed ? (
          <>
            <h1 className="text-xl font-semibold text-ink">Ссылка недействительна или отозвана</h1>
            <p className="mt-2 text-sm text-slate-500">
              Попросите владельца компании выдать новую ссылку.
            </p>
            <Link
              className="mt-6 inline-block text-sm font-medium text-primary-600 hover:underline"
              to="/auth/login"
            >
              Войти по email и паролю
            </Link>
          </>
        ) : (
          <>
            <LoaderCircle className="mx-auto size-8 animate-spin text-primary-600" />
            <p className="mt-4 text-sm text-slate-600">Проверяем ссылку доступа…</p>
          </>
        )}
      </div>
    </main>
  );
}
