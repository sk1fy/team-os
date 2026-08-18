import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { CheckCircle2, Copy } from 'lucide-react';
import { authApi } from '@/api';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { RequireAuth } from '@/components/auth/AuthBootstrap';
import { Button, Input } from '@/components/ui';
import { copyText } from '@/lib/clipboard';
import { useAuthStore } from '@/stores/auth';
import type { AmoWidgetContinuation } from '@/types';
import { PublicAuthError } from './PublicAuthError';
import { amoWidgetContinuationErrorView, type PublicAuthErrorView } from './publicAuthFlow';
import { claimOneTimeRequest, useOneTimeQueryValue } from './useOneTimeQueryToken';
import {
  amoSessionAccessErrorView,
  isValidAmoAccountId,
  safeAmoSessionRedirect,
} from './amoSessionAccess';

export function AmoWidgetAuthPage() {
  const [searchParams] = useSearchParams();
  const sessionMode = searchParams.get('mode') === 'session';
  const accountId = searchParams.get('accountId')?.trim() ?? '';

  if (sessionMode) {
    return (
      <RequireAuth>
        <AmoSessionAccessPage key={accountId} accountId={accountId} />
      </RequireAuth>
    );
  }

  return <AmoWidgetContinuationPage />;
}

function AmoSessionAccessPage({ accountId }: { accountId: string }) {
  useTitle('Вход из amoCRM — TeamOS');
  const navigate = useNavigate();
  const location = useLocation();
  const requestStartedRef = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<PublicAuthErrorView>();

  useEffect(() => {
    if (!claimOneTimeRequest(requestStartedRef)) return;
    if (!isValidAmoAccountId(accountId)) {
      setError({
        title: 'Некорректная ссылка',
        description: 'Вернитесь в amoCRM и снова нажмите кнопку «Перейти в TeamOS».',
        action: 'none',
      });
      return;
    }

    setError(undefined);
    void authApi
      .authorizeAmoSession({ amoAccountId: accountId })
      .then((access) => {
        if (!access.allowed) {
          setError(amoSessionAccessErrorView(new ApiError('Доступ не подтверждён', 403)));
          return;
        }
        const redirectPath = safeAmoSessionRedirect(access.redirectUrl);
        if (!redirectPath) {
          setError(
            amoSessionAccessErrorView(
              new ApiError('TeamOS вернул недопустимый адрес перехода', 502),
            ),
          );
          return;
        }
        navigate(redirectPath, { replace: true });
      })
      .catch((caught: unknown) => {
        if (caught instanceof ApiError && caught.status === 401) {
          useAuthStore.getState().clear();
          navigate('/auth/login', { replace: true, state: { from: location } });
          return;
        }
        setError(amoSessionAccessErrorView(caught));
      });
  }, [accountId, attempt, location, navigate]);

  if (error) {
    return (
      <PublicAuthError
        error={error}
        onRetry={
          error.action === 'retry'
            ? () => {
                requestStartedRef.current = false;
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
      <h1 className="mt-5 text-xl font-semibold text-slate-950">Проверяем доступ…</h1>
      <p className="mt-2 text-sm text-slate-500">Подтверждаем компанию и вашу роль.</p>
    </div>
  );
}

function AmoWidgetContinuationPage() {
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
  const [loginCopyStatus, setLoginCopyStatus] = useState<string>();

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

      <div className="mt-5 rounded-lg border-2 border-primary-200 bg-primary-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium tracking-wide text-primary-700 uppercase">
              Ваш логин для входа
            </p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-wider text-primary-950">
              {continuation.login}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="shrink-0 px-2"
            aria-label="Скопировать логин"
            onClick={() => {
              void copyText(continuation.login).then((copied) =>
                setLoginCopyStatus(copied ? 'Логин скопирован' : 'Не удалось скопировать'),
              );
            }}
          >
            <Copy className="size-4" />
          </Button>
        </div>
        <p className="mt-2 text-xs leading-5 text-primary-800">
          Сохраните его: для следующих входов используйте этот логин и пароль.
        </p>
        {loginCopyStatus ? (
          <p className="mt-1 text-xs font-medium text-primary-800">{loginCopyStatus}</p>
        ) : null}
        <p className="mt-3 truncate border-t border-primary-200 pt-3 text-xs text-primary-800">
          Контактный email: {continuation.email}
        </p>
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
