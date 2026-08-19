import { queryKeys } from '@/api/queryKeys';
import { useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { Button, Input } from '@/components/ui';
import { authApi } from '@/api';
import { ApiError } from '@/api/client';
import { resolvePostLoginPath } from '@/lib/permissions';

export function LoginPage() {
  useTitle('Вход — TeamOS');
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [loginError, setLoginError] = useState<string>();
  const loginRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const login = String(form.get('login') ?? '')
      .trim()
      .toLowerCase();
    if (!/^tm\d{7}$/.test(login)) {
      setLoginError('Введите логин в формате tm1234567');
      loginRef.current?.focus();
      return;
    }
    setLoginError(undefined);
    setSubmitting(true);
    try {
      const session = await authApi.login({
        login,
        password: String(form.get('password') ?? ''),
      });
      queryClient.setQueryData(queryKeys.currentUser, session.user);
      const from = (
        location.state as {
          from?: { pathname?: string; search?: string; hash?: string };
        } | null
      )?.from;
      const pathname = resolvePostLoginPath(
        session.user.role,
        from?.pathname,
        session.user.sectionAccess,
      );
      const isAllowedReturnPath = from?.pathname === pathname;
      navigate(
        isAllowedReturnPath ? `${pathname}${from?.search ?? ''}${from?.hash ?? ''}` : pathname,
        { replace: true },
      );
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
          label="Логин"
          ref={loginRef}
          name="login"
          type="text"
          placeholder="tm1234567"
          autoComplete="username"
          required
          error={loginError}
          onChange={() => loginError && setLoginError(undefined)}
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
        <Button type="submit" className="w-full" loading={submitting}>
          Войти
        </Button>
      </form>
    </div>
  );
}
