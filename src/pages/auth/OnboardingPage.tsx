import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { Copy, RefreshCw } from 'lucide-react';
import { authApi } from '@/api';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { Button, Input } from '@/components/ui';
import { copyText } from '@/lib/clipboard';
import { safeHomePath } from '@/lib/permissions';
import { useAuthStore } from '@/stores/auth';
import type { BootstrapActivation, OnboardingState, User } from '@/types';
import { PublicAuthError } from './PublicAuthError';
import {
  activationStateError,
  companyStatusError,
  publicAuthErrorView,
  validateActivationPasswords,
  type PublicAuthErrorView,
} from './publicAuthFlow';
import { claimOneTimeRequest, useOneTimeQueryToken } from './useOneTimeQueryToken';

const roleLabels = { owner: 'Владелец', admin: 'Администратор' } as const;
const dateTimeFormatter = new Intl.DateTimeFormat('ru', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatExpiry(value?: string) {
  return value ? dateTimeFormatter.format(new Date(value)) : 'Срок не указан';
}

export function OnboardingPage() {
  useTitle('Активация — TeamOS');
  const token = useOneTimeQueryToken();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const startedRef = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [activation, setActivation] = useState<BootstrapActivation>();
  const [onboarding, setOnboarding] = useState<OnboardingState>();
  const [activatedUser, setActivatedUser] = useState<User>();
  const [error, setError] = useState<PublicAuthErrorView>();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordError, setPasswordError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [reissuing, setReissuing] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string>();

  useEffect(() => {
    if (!token) {
      setError(
        publicAuthErrorView(
          new ApiError('Ссылка недействительна', 400, { code: 'BOOTSTRAP_INVALID' }),
        ),
      );
      return;
    }
    if (!claimOneTimeRequest(startedRef)) return;
    setError(undefined);

    void authApi
      .getBootstrapActivation(token)
      .then((result) => {
        const stateError = activationStateError(result.state);
        const statusError = companyStatusError(result.companyStatus);
        if (stateError || statusError) {
          setError(publicAuthErrorView(stateError ?? statusError));
          return;
        }
        setActivation(result);
      })
      .catch((caught: unknown) => setError(publicAuthErrorView(caught)));
  }, [attempt, token]);

  const finishOnboarding = async (fallbackUser: User) => {
    queryClient.removeQueries({ queryKey: queryKeys.onboarding.all });
    queryClient.setQueryData(queryKeys.currentUser, fallbackUser);
    const [userResult, companyResult] = await Promise.allSettled([
      authApi.getCurrentUser(),
      authApi.getCompany(),
    ]);
    const currentUser = userResult.status === 'fulfilled' ? userResult.value : fallbackUser;
    queryClient.setQueryData(queryKeys.currentUser, currentUser);
    if (companyResult.status === 'fulfilled') {
      queryClient.setQueryData(queryKeys.company, companyResult.value);
    }
    navigate(safeHomePath(currentUser.role, currentUser.sectionAccess), { replace: true });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const validationError = validateActivationPasswords(password, confirmation);
    if (validationError) {
      setPasswordError(validationError);
      return;
    }
    setPasswordError(undefined);
    setSubmitting(true);
    try {
      const session = await authApi.completeBootstrapActivation(token, { password });
      useAuthStore.getState().setAccessToken(session.accessToken);
      useAuthStore.getState().setInitialized(true);
      queryClient.clear();
      queryClient.setQueryData(queryKeys.currentUser, session.user);
      queryClient.removeQueries({ queryKey: queryKeys.onboarding.all });
      setActivatedUser(session.user);
      setOnboarding(session.onboarding);
      if (session.onboarding.completed) await finishOnboarding(session.user);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) {
        setPasswordError(caught.message);
      } else {
        setError(publicAuthErrorView(caught));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!onboarding?.activationUrl) return;
    setCopyStatus(
      (await copyText(onboarding.activationUrl))
        ? 'Ссылка скопирована'
        : 'Не удалось скопировать ссылку',
    );
  };

  const handleReissue = async () => {
    setReissuing(true);
    setCopyStatus(undefined);
    try {
      const next = await authApi.reissueOnboardingActivation();
      setOnboarding(next);
      if (next.completed && activatedUser) await finishOnboarding(activatedUser);
    } catch (caught) {
      setError(publicAuthErrorView(caught));
    } finally {
      setReissuing(false);
    }
  };

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

  if (onboarding && !onboarding.completed) {
    const pending = onboarding.pendingUser;
    return (
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-surface p-8 shadow-card">
        <h1 className="text-xl font-semibold text-slate-950">Остался ещё один участник</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Чтобы завершить настройку компании, передайте персональную ссылку второму участнику.
        </p>
        {pending ? (
          <dl className="mt-6 grid gap-3 rounded-lg bg-slate-50 p-4 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Участник</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {[pending.firstName, pending.lastName].filter(Boolean).join(' ')}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Email и роль</dt>
              <dd className="mt-1 text-slate-700">
                {pending.email} · {roleLabels[pending.role]}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Ссылка действует до</dt>
              <dd className="mt-1 text-slate-700">{formatExpiry(onboarding.expiresAt)}</dd>
            </div>
          </dl>
        ) : null}
        {onboarding.activationUrl ? (
          <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs break-all text-slate-600">
            {onboarding.activationUrl}
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={() => void handleCopy()} disabled={!onboarding.activationUrl}>
            <Copy className="size-4" />
            Копировать ссылку
          </Button>
          <Button variant="secondary" loading={reissuing} onClick={() => void handleReissue()}>
            <RefreshCw className="size-4" />
            Перевыпустить
          </Button>
        </div>
        {copyStatus ? <p className="mt-3 text-sm text-slate-600">{copyStatus}</p> : null}
      </div>
    );
  }

  if (!activation) {
    return (
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-surface p-8 text-center shadow-card"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="mx-auto size-8 animate-spin rounded-full border-3 border-primary-100 border-t-primary-600" />
        <h1 className="mt-5 text-xl font-semibold text-slate-950">Проверяем ссылку…</h1>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-surface p-8 shadow-card">
      <h1 className="text-xl font-semibold text-slate-950">Добро пожаловать в TeamOS</h1>
      <p className="mt-2 text-sm text-slate-500">Создайте пароль для доступа к компании.</p>
      <dl className="mt-6 grid gap-3 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-slate-500">Компания</dt>
          <dd className="mt-1 font-medium text-slate-900">{activation.companyName}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Ваша роль</dt>
          <dd className="mt-1 font-medium text-slate-900">{roleLabels[activation.user.role]}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Пользователь</dt>
          <dd className="mt-1 text-slate-700">
            {[activation.user.firstName, activation.user.lastName].filter(Boolean).join(' ')}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Email</dt>
          <dd className="mt-1 text-slate-700">{activation.user.email}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-slate-500">Ссылка действует до</dt>
          <dd className="mt-1 text-slate-700">{formatExpiry(activation.expiresAt)}</dd>
        </div>
      </dl>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <Input
          label="Пароль"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (passwordError) setPasswordError(undefined);
          }}
          error={passwordError}
          hint="Не менее 8 символов"
          required
          minLength={8}
        />
        <Input
          label="Подтвердите пароль"
          type="password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => {
            setConfirmation(event.target.value);
            if (passwordError) setPasswordError(undefined);
          }}
          required
        />
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
          Используйте не менее 8 символов. Окончательные требования к паролю проверит TeamOS.
        </div>
        <Button type="submit" className="w-full" loading={submitting}>
          Создать пароль и продолжить
        </Button>
      </form>
    </div>
  );
}
