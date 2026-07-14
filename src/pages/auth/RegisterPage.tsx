import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTitle } from '@reactuses/core';
import { Button, Input } from '@/components/ui';
import { authApi } from '@/api';
import { ApiError } from '@/api/client';

export function RegisterPage() {
  useTitle('Регистрация — TeamOS');
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);
    try {
      await authApi.register({
        companyName: String(form.get('companyName') ?? ''),
        firstName: String(form.get('firstName') ?? ''),
        lastName: String(form.get('lastName') ?? ''),
        email: String(form.get('email') ?? ''),
        password: String(form.get('password') ?? ''),
      });
      navigate('/', { replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Не удалось зарегистрироваться. Попробуйте ещё раз.',
      );
    } finally {
      setSubmitting(false);
    }
  };

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
          name="email"
          type="email"
          placeholder="you@company.ru"
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
        {error && <p className="text-sm text-danger-600">{error}</p>}
        <Button type="submit" className="w-full" loading={submitting}>
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
