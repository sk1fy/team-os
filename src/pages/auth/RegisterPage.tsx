import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTitle } from '@reactuses/core';
import { Button, Input } from '@/components/ui';

export function RegisterPage() {
  useTitle('Регистрация — TeamOS');
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  // После регистрации новый пользователь создаёт компанию.
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setTimeout(() => navigate('/auth/create-company'), 600);
  };

  return (
    <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-surface p-8 shadow-card">
      <h2 className="text-center">Создать аккаунт</h2>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Имя" placeholder="Анна" autoComplete="given-name" required />
          <Input label="Фамилия" placeholder="Смирнова" autoComplete="family-name" required />
        </div>
        <Input
          label="Рабочий email"
          type="email"
          placeholder="you@company.ru"
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
          Продолжить
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
