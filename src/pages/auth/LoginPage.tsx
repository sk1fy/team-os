import { useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { Button, Input } from '@/components/ui';
import { authApi } from '@/api';
import { ApiError } from '@/api/client';
import { EMAIL_ERROR, isValidEmail } from '@/lib/formValidation';

export function LoginPage() {
  useTitle('Вход — TeamOS');
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [emailError, setEmailError] = useState<string>();
  const emailRef = useRef<HTMLInputElement>(null);

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
    setSubmitting(true);
    try {
      const session = await authApi.login({
        email,
        password: String(form.get('password') ?? ''),
      });
      queryClient.setQueryData(['currentUser'], session.user);
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(from ?? '/', { replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Не удалось войти. Попробуйте ещё раз.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-surface p-8 shadow-card">
      <h2 className="text-center">Вход в аккаунт</h2>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Input
          label="Email"
          ref={emailRef}
          name="email"
          type="email"
          placeholder="you@company.ru"
          autoComplete="email"
          required
          error={emailError}
          onChange={() => emailError && setEmailError(undefined)}
        />
        <Input
          label="Пароль"
          name="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />
        {error && <p className="text-sm text-danger-600">{error}</p>}
        <div className="text-right">
          <a href="#" className="text-xs text-primary-600 hover:underline">
            Забыли пароль?
          </a>
        </div>
        <Button type="submit" className="w-full" loading={submitting}>
          Войти
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Нет аккаунта?{' '}
        <Link to="/auth/register" className="font-medium text-primary-600 hover:underline">
          Зарегистрироваться
        </Link>
      </p>
    </div>
  );
}
