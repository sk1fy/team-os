import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTitle } from '@reactuses/core';
import { Copy, RefreshCw } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { authApi } from '@/api';
import { ApiError } from '@/api/client';
import type { CompanyRegistrationTokenValidation, RegistrationLoginReservation } from '@/types';
import { EMAIL_ERROR, isValidEmail } from '@/lib/formValidation';
import { copyText } from '@/lib/clipboard';
import { safeHomePath } from '@/lib/permissions';
import { PublicAuthError } from './PublicAuthError';
import { registrationTokenErrorView, type PublicAuthErrorView } from './publicAuthFlow';
import { claimOneTimeRequest, useOneTimeQueryValue } from './useOneTimeQueryToken';

function isValidRegistrationToken(
  validation: CompanyRegistrationTokenValidation,
): validation is CompanyRegistrationTokenValidation & { amoAccountId: string } {
  return (
    validation.valid === true &&
    validation.state === 'valid' &&
    typeof validation.amoAccountId === 'string' &&
    validation.amoAccountId.length > 0
  );
}

export function RegisterPage() {
  useTitle('Регистрация — TeamOS');
  const queryToken = useOneTimeQueryValue('registrationToken');
  const queryRegistrationToken = queryToken.value;
  const navigate = useNavigate();
  const [registrationToken, setRegistrationToken] = useState(queryRegistrationToken);
  const [validatedToken, setValidatedToken] = useState('');
  const [tokenValidation, setTokenValidation] = useState<CompanyRegistrationTokenValidation>();
  const [tokenError, setTokenError] = useState<string>();
  const [linkError, setLinkError] = useState<PublicAuthErrorView>();
  const [validatingLink, setValidatingLink] = useState(queryToken.present);
  const [validationAttempt, setValidationAttempt] = useState(0);
  const validationStartedRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [emailError, setEmailError] = useState<string>();
  const [loginReservation, setLoginReservation] = useState<RegistrationLoginReservation>();
  const [loginReservationError, setLoginReservationError] = useState<string>();
  const [reservingLogin, setReservingLogin] = useState(false);
  const [loginCopyStatus, setLoginCopyStatus] = useState<string>();
  const emailRef = useRef<HTMLInputElement>(null);

  const reserveLogin = useCallback(async () => {
    setReservingLogin(true);
    setLoginReservationError(undefined);
    setLoginCopyStatus(undefined);
    try {
      setLoginReservation(await authApi.reserveRegistrationLogin());
    } catch (caught) {
      setLoginReservation(undefined);
      setLoginReservationError(
        caught instanceof ApiError
          ? caught.message
          : 'Не удалось подготовить логин. Попробуйте ещё раз.',
      );
    } finally {
      setReservingLogin(false);
    }
  }, []);

  useEffect(() => {
    if (queryToken.present && !tokenValidation) return;
    void reserveLogin();
  }, [queryToken.present, reserveLogin, tokenValidation]);

  useEffect(() => {
    if (!queryToken.present || !claimOneTimeRequest(validationStartedRef)) return;
    if (!queryRegistrationToken) {
      setLinkError(registrationTokenErrorView(undefined, 'invalid'));
      setValidatingLink(false);
      return;
    }
    setValidatingLink(true);
    setLinkError(undefined);

    void authApi
      .validateCompanyRegistrationToken(queryRegistrationToken)
      .then((validation) => {
        if (!isValidRegistrationToken(validation)) {
          setLinkError(registrationTokenErrorView(undefined, validation.state));
          return;
        }
        setTokenValidation(validation);
        setValidatedToken(queryRegistrationToken);
      })
      .catch((caught: unknown) => setLinkError(registrationTokenErrorView(caught)))
      .finally(() => setValidatingLink(false));
  }, [queryRegistrationToken, queryToken.present, validationAttempt]);

  const validateToken = async (
    token: string,
  ): Promise<CompanyRegistrationTokenValidation | undefined> => {
    try {
      const validation = await authApi.validateCompanyRegistrationToken(token);
      if (!isValidRegistrationToken(validation)) {
        setTokenValidation(undefined);
        setValidatedToken('');
        setTokenError(registrationTokenErrorView(undefined, validation.state).description);
        return undefined;
      }
      setTokenValidation(validation);
      setValidatedToken(token);
      setTokenError(undefined);
      return validation;
    } catch (caught) {
      setTokenValidation(undefined);
      setValidatedToken('');
      setTokenError(registrationTokenErrorView(caught).description);
      return undefined;
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    if (!isValidEmail(email)) {
      setEmailError(EMAIL_ERROR);
      emailRef.current?.focus();
      return;
    }
    setEmailError(undefined);
    if (!loginReservation) {
      setLoginReservationError('Сначала получите логин для входа');
      return;
    }
    setSubmitting(true);
    const token = registrationToken.trim();
    try {
      if (token && validatedToken !== token && !(await validateToken(token))) return;

      const session = await authApi.register({
        companyName: String(form.get('companyName') ?? '').trim(),
        firstName: String(form.get('firstName') ?? '').trim(),
        lastName: String(form.get('lastName') ?? '').trim(),
        email,
        password: String(form.get('password') ?? ''),
        ...(token ? { registrationToken: token } : {}),
        loginReservationToken: loginReservation.reservationToken,
      });
      setRegistrationToken('');
      setValidatedToken('');
      setTokenValidation(undefined);
      navigate(safeHomePath(session.user.role, session.user.sectionAccess), { replace: true });
    } catch (caught) {
      const registrationError = registrationTokenErrorView(caught);
      if (caught instanceof ApiError && caught.code?.startsWith('LOGIN_RESERVATION_')) {
        setLoginReservation(undefined);
        setLoginReservationError(caught.message);
      }
      setError(
        caught instanceof ApiError &&
          (caught.code?.startsWith('REGISTRATION_TOKEN_') ||
            caught.code === 'AMO_ACCOUNT_ALREADY_EXISTS')
          ? `${registrationError.title}. ${registrationError.description}`
          : caught instanceof ApiError
            ? caught.message
            : 'Не удалось зарегистрироваться. Попробуйте ещё раз.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (validatingLink) {
    return (
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-surface p-8 text-center shadow-card"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="mx-auto size-8 animate-spin rounded-full border-3 border-primary-100 border-t-primary-600" />
        <h1 className="mt-5 text-xl font-semibold text-slate-950">Проверяем ссылку…</h1>
        <p className="mt-2 text-sm text-slate-500">Это займёт всего несколько секунд.</p>
      </div>
    );
  }

  if (linkError) {
    return (
      <PublicAuthError
        error={linkError}
        onRetry={
          linkError.action === 'retry'
            ? () => {
                validationStartedRef.current = false;
                setValidationAttempt((value) => value + 1);
              }
            : undefined
        }
      />
    );
  }

  return (
    <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-surface p-8 shadow-card">
      <h2 className="text-center">Создать аккаунт</h2>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Input
          label="Название компании"
          name="companyName"
          placeholder="Ромашка Digital"
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Имя"
            name="firstName"
            placeholder="Анна"
            autoComplete="given-name"
            required
          />
          <Input
            label="Фамилия"
            name="lastName"
            placeholder="Смирнова"
            autoComplete="family-name"
            required
          />
        </div>
        <Input
          label="Рабочий email"
          ref={emailRef}
          name="email"
          type="email"
          placeholder="you@company.ru"
          autoComplete="email"
          required
          error={emailError}
          onChange={() => emailError && setEmailError(undefined)}
        />
        <div className="rounded-lg border-2 border-primary-200 bg-primary-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium tracking-wide text-primary-700 uppercase">
                Ваш логин для входа
              </p>
              {loginReservation ? (
                <p className="mt-1 font-mono text-2xl font-bold tracking-wider text-primary-950">
                  {loginReservation.login}
                </p>
              ) : (
                <p className="mt-2 text-sm text-primary-800">
                  {reservingLogin ? 'Генерируем логин…' : 'Логин пока не получен'}
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="ghost"
                className="px-2"
                disabled={!loginReservation}
                aria-label="Скопировать логин"
                onClick={() => {
                  if (!loginReservation) return;
                  void copyText(loginReservation.login).then((copied) =>
                    setLoginCopyStatus(copied ? 'Логин скопирован' : 'Не удалось скопировать'),
                  );
                }}
              >
                <Copy className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="px-2"
                loading={reservingLogin}
                aria-label="Получить новый логин"
                onClick={() => void reserveLogin()}
              >
                <RefreshCw className="size-4" />
              </Button>
            </div>
          </div>
          <p className="mt-2 text-xs leading-5 text-primary-800">
            Сохраните этот логин: после регистрации он понадобится вместе с паролем.
          </p>
          {loginCopyStatus ? (
            <p className="mt-1 text-xs font-medium text-primary-800">{loginCopyStatus}</p>
          ) : null}
          {loginReservationError ? (
            <p className="mt-2 text-sm text-danger-600">{loginReservationError}</p>
          ) : null}
        </div>
        <Input
          label="Пароль"
          name="password"
          type="password"
          placeholder="Минимум 8 символов"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <Input
          label="Необязательное поле"
          name="registrationToken"
          type="password"
          autoComplete="off"
          value={registrationToken}
          placeholder="Токен регистрации"
          hint={
            tokenValidation?.amoAccountId
              ? 'Токен подтверждён · amoCRM будет подключена после регистрации.'
              : 'Оставьте поле пустым, чтобы создать обычную компанию.'
          }
          error={tokenError}
          onChange={(event) => {
            setRegistrationToken(event.target.value);
            setValidatedToken('');
            setTokenValidation(undefined);
            setTokenError(undefined);
          }}
        />
        {error && <p className="text-sm text-danger-600">{error}</p>}
        <Button
          type="submit"
          className="w-full"
          loading={submitting}
          disabled={!loginReservation || reservingLogin}
        >
          Создать компанию
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Уже есть аккаунт?{' '}
        <Link to="/auth/login" className="font-medium text-primary-600 hover:underline">
          Войти
        </Link>
      </p>
    </div>
  );
}
