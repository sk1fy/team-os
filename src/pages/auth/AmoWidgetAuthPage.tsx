import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { CheckCircle2 } from 'lucide-react';
import { authApi } from '@/api';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { Button, Input } from '@/components/ui';
import type { AmoWidgetContinuation } from '@/types';
import { PublicAuthError } from './PublicAuthError';
import { amoWidgetContinuationErrorView, type PublicAuthErrorView } from './publicAuthFlow';
import { claimOneTimeRequest, useOneTimeQueryValue } from './useOneTimeQueryToken';

export function AmoWidgetAuthPage() {
  useTitle('Вход из amoCRM — TeamOS');
  const continuationToken = useOneTimeQueryValue('sessionToken');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const validationStartedRef = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [continuation, setContinuation] = useState<AmoWidgetContinuation>();
  const [error, setError] = useState<PublicAuthErrorView>();
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!claimOneTimeRequest(validationStartedRef)) return;
    if (!continuationToken.present || !continuationToken.value) {
      setError(
        amoWidgetContinuationErrorView(
          new ApiError('Ссылка входа из amoCRM недействительна', 401, {
            code: 'AMO_WIDGET_CONTINUATION_INVALID',
          }),
        ),
      );
      return;
    }
    setError(undefined);
    void authApi
      .validateAmoWidgetContinuation(continuationToken.value)
      .then(setContinuation)
      .catch((caught: unknown) => setError(amoWidgetContinuationErrorView(caught)));
  }, [attempt, continuationToken.present, continuationToken.value]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (password.length < 8) {
      setPasswordError('Пароль должен содержать не менее 8 символов');
      return;
    }
    setPasswordError(undefined);
    setSubmitting(true);
    try {
      const session = await authApi.completeAmoWidgetContinuation({
        sessionToken: continuationToken.value,
        password,
      });
      queryClient.clear();
      queryClient.setQueryData(queryKeys.currentUser, session.user);
      navigate('/employees', { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'AMO_WIDGET_PASSWORD_INVALID') {
        setPasswordError('Неверный пароль');
      } else if (caught instanceof ApiError && caught.status === 400) {
        setPasswordError(caught.message);
      } else {
        setError(amoWidgetContinuationErrorView(caught));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <PublicAuthError
        error={error}
        onRetry={
          error.action === 'retry'
            ? () => {
                validationStartedRef.current = false;
                setAttempt((value) => value + 1);
              }
            : undefined
        }
      />
    );
  }

  if (!continuation) {
    return (
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-surface p-8 text-center shadow-card"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="mx-auto size-8 animate-spin rounded-full border-3 border-primary-100 border-t-primary-600" />
        <h1 className="mt-5 text-xl font-semibold text-slate-950">Открываем вашу компанию…</h1>
        <p className="mt-2 text-sm text-slate-500">Получаем данные из amoCRM.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-slate-200 bg-surface p-8 shadow-card">
      <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
        <div>
          <p className="font-medium text-emerald-950">
            {continuation.requiresPasswordSetup ? 'Компания создана' : 'Компания найдена'}
          </p>
          <p className="mt-1 text-sm text-emerald-800">{continuation.companyName}</p>
        </div>
      </div>

      <h1 className="mt-6 text-xl font-semibold text-slate-950">
        {continuation.requiresPasswordSetup ? 'Создайте пароль' : 'Введите пароль'}
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        {continuation.requiresPasswordSetup
          ? 'Email и профиль администратора уже получены из amoCRM.'
          : 'После проверки пароля откроется ваша компания TeamOS.'}
      </p>

      <div className="mt-5 rounded-lg bg-slate-50 p-4">
        <p className="text-xs text-slate-500">Аккаунт администратора</p>
        <p className="mt-1 truncate text-sm font-medium text-slate-900">{continuation.email}</p>
      </div>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <Input
          label="Пароль"
          type="password"
          autoComplete={continuation.requiresPasswordSetup ? 'new-password' : 'current-password'}
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (passwordError) setPasswordError(undefined);
          }}
          placeholder="Минимум 8 символов"
          error={passwordError}
          required
          minLength={8}
          maxLength={256}
          autoFocus
        />
        <Button type="submit" className="w-full" loading={submitting}>
          {continuation.requiresPasswordSetup
            ? 'Сохранить пароль и продолжить'
            : 'Войти в компанию'}
        </Button>
      </form>
    </div>
  );
}
