import { queryKeys } from '@/api/queryKeys';
import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { authApi } from '@/api';
import { ApiError } from '@/api/client';
import { Button, Input } from '@/components/ui';
import { toast } from '@/stores/toast';

/**
 * Страница приёма приглашения по ссылке /auth/invite/:token.
 * Для демо работает токен `demo-invite-token` из фикстур.
 */
export function InvitePage() {
  useTitle('Приглашение — TeamOS');
  const navigate = useNavigate();
  const { token = '' } = useParams();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  const {
    data: invite,
    isPending,
    isError,
  } = useQuery({
    queryKey: queryKeys.invite(token),
    queryFn: () => authApi.getInviteByToken(token),
    retry: 1,
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(undefined);
    const form = new FormData(event.currentTarget);
    try {
      await authApi.acceptInvite(token, {
        email: invite?.email ? undefined : String(form.get('email') ?? ''),
        firstName: String(form.get('firstName') ?? ''),
        lastName: String(form.get('lastName') ?? ''),
        password: String(form.get('password') ?? ''),
      });
      toast.success('Добро пожаловать в команду!');
      navigate('/', { replace: true });
    } catch (caught) {
      setSubmitError(
        caught instanceof ApiError ? caught.message : 'Не удалось принять приглашение.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (isPending) {
    return (
      <div className="w-full max-w-sm space-y-3 rounded-xl border border-slate-200 bg-surface p-8 shadow-card">
        <div className="h-6 animate-pulse rounded bg-slate-200" />
        <div className="h-9 animate-pulse rounded bg-slate-200" />
        <div className="h-9 animate-pulse rounded bg-slate-200" />
      </div>
    );
  }

  if (isError || !invite || invite.status !== 'pending') {
    return (
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-surface p-8 text-center shadow-card">
        <h2>Приглашение недействительно</h2>
        <p className="mt-2 text-sm text-slate-500">
          Ссылка устарела или уже использована. Попросите администратора отправить новую.
        </p>
        <Button variant="secondary" className="mt-6" onClick={() => navigate('/auth/login')}>
          Перейти ко входу
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-surface p-8 shadow-card">
      <h2 className="text-center">Вас пригласили в «Ромашка Digital»</h2>
      <p className="mt-2 text-center text-sm text-slate-500">
        Заполните профиль, чтобы присоединиться к команде.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Имя"
            name="firstName"
            placeholder="Ольга"
            autoComplete="given-name"
            required
          />
          <Input
            label="Фамилия"
            name="lastName"
            placeholder="Лебедева"
            autoComplete="family-name"
            required
          />
        </div>
        <Input
          label="Email"
          name="email"
          type="email"
          defaultValue={invite.email}
          readOnly={Boolean(invite.email)}
          autoComplete="email"
          required
        />
        <Input
          label="Пароль"
          name="password"
          type="password"
          placeholder="Минимум 8 символов"
          autoComplete="new-password"
          minLength={8}
          required
        />
        {submitError && <p className="text-sm text-danger-600">{submitError}</p>}
        <Button type="submit" className="w-full" loading={submitting}>
          Присоединиться
        </Button>
      </form>
    </div>
  );
}
