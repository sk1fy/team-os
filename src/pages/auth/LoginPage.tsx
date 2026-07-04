import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTitle } from 'react-use';
import { Button, Input } from '@/components/ui';

export function LoginPage() {
  useTitle('Вход — TeamOS');
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  // Реальной авторизации нет — имитируем запрос и заходим в приложение.
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setTimeout(() => navigate('/'), 600);
  };

  return (
    <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-surface p-8 shadow-card">
      <h2 className="text-center">Вход в аккаунт</h2>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Input
          label="Email"
          type="email"
          placeholder="you@company.ru"
          autoComplete="email"
          required
        />
        <Input
          label="Пароль"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />
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
