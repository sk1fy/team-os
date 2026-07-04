import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTitle } from 'react-use';
import { authApi } from '@/api';
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

  const { data: invite, isPending, isError } = useQuery({
    queryKey: ['invite', token],
    queryFn: () => authApi.getInviteByToken(token),
    retry: 1,
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      toast.success('Добро пожаловать в команду!');
      navigate('/');
    }, 600);
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
          <Input label="Имя" placeholder="Ольга" autoComplete="given-name" required />
          <Input label="Фамилия" placeholder="Лебедева" autoComplete="family-name" required />
        </div>
        <Input
          label="Email"
          type="email"
          defaultValue={invite.email}
          autoComplete="email"
          required
        />
        <Input
          label="Пароль"
          type="password"
          placeholder="Минимум 8 символов"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <Button type="submit" className="w-full" loading={submitting}>
          Присоединиться
        </Button>
      </form>
    </div>
  );
}
