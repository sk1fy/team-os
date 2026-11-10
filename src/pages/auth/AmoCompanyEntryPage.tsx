import { useEffect, useLayoutEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { assertCurrentSession } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import {
  createCompanyEntryExchange,
  exchangeCompanyEntry,
  parseCompanyEntryFragment,
} from './amoCompanyEntry';

export function AmoCompanyEntryFeedback({ failed }: { failed: boolean }) {
  return (
    <div
      className="w-full max-w-md rounded-xl border border-slate-200 bg-surface p-8 text-center shadow-card"
      role="status"
      aria-live="polite"
      aria-busy={!failed}
    >
      <h1 className="text-xl font-semibold text-slate-950">
        {failed ? 'Не удалось войти в компанию' : 'Открываем вашу компанию…'}
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        {failed
          ? 'Вернитесь в настройки виджета amoCRM и нажмите кнопку входа ещё раз. Если доступ ограничен, обратитесь к администратору TeamOS.'
          : 'Проверяем одноразовую ссылку входа из amoCRM.'}
      </p>
    </div>
  );
}

export function AmoCompanyEntryPage() {
  useTitle('Вход из amoCRM — TeamOS');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [entry] = useState(() => parseCompanyEntryFragment(window.location.hash));
  const [exchangeOnce] = useState(() =>
    createCompanyEntryExchange(() => {
      if (entry.kind !== 'code') return Promise.reject(new Error('Недействительная ссылка'));
      return exchangeCompanyEntry(entry.code);
    }),
  );
  const [failed, setFailed] = useState(entry.kind === 'invalid');

  useLayoutEffect(() => {
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname + window.location.search,
    );
  }, []);

  useEffect(() => {
    let active = true;
    if (entry.kind !== 'code') return;
    void exchangeOnce()
      .then(async (session) => {
        if (!active) return;
        assertCurrentSession(session);
        await queryClient.cancelQueries();
        if (!active) return;
        assertCurrentSession(session);
        queryClient.clear();
        queryClient.setQueryData(queryKeys.currentUser, session.user);
        navigate('/employees', { replace: true });
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [entry, exchangeOnce, navigate, queryClient]);

  return <AmoCompanyEntryFeedback failed={failed} />;
}
