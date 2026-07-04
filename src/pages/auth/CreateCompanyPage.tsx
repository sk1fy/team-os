import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTitle } from '@reactuses/core';
import { Check } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';
import { toast } from '@/stores/toast';
import { cn } from '@/lib/cn';

const steps = ['О компании', 'О вас', 'Команда'];

const companySizeOptions = [
  { value: '1-10', label: '1–10 человек' },
  { value: '11-50', label: '11–50 человек' },
  { value: '51-200', label: '51–200 человек' },
  { value: '200+', label: 'Больше 200' },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="flex items-center justify-center gap-2">
      {steps.map((step, index) => (
        <li key={step} className="flex items-center gap-2">
          <span
            className={cn(
              'flex size-7 items-center justify-center rounded-full text-xs font-semibold',
              index < current
                ? 'bg-primary-600 text-white'
                : index === current
                  ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-600'
                  : 'bg-slate-100 text-slate-400',
            )}
          >
            {index < current ? <Check className="size-4" /> : index + 1}
          </span>
          <span
            className={cn(
              'text-sm',
              index === current ? 'font-medium text-slate-900' : 'text-slate-400',
            )}
          >
            {step}
          </span>
          {index < steps.length - 1 && <span className="mx-1 h-px w-6 bg-slate-200" />}
        </li>
      ))}
    </ol>
  );
}

export function CreateCompanyPage() {
  useTitle('Создание компании — TeamOS');
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [companySize, setCompanySize] = useState<string>();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      toast.success('Компания создана', 'Добро пожаловать в TeamOS!');
      navigate('/');
    }
  };

  return (
    <div className="w-full max-w-lg">
      <StepIndicator current={step} />
      <form
        onSubmit={handleSubmit}
        className="mt-6 rounded-xl border border-slate-200 bg-surface p-8 shadow-card"
      >
        {step === 0 && (
          <div className="space-y-4">
            <h2>Расскажите о компании</h2>
            <Input label="Название компании" placeholder="Ромашка Digital" required />
            <Select
              label="Размер команды"
              options={companySizeOptions}
              value={companySize}
              onValueChange={setCompanySize}
            />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2>Ваша роль</h2>
            <Input label="Должность" placeholder="Генеральный директор" required />
            <Input label="Телефон" type="tel" placeholder="+7 900 000-00-00" />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2>Пригласите команду</h2>
            <p className="text-sm text-slate-500">
              Введите email коллег через запятую — они получат приглашение. Этот шаг можно
              пропустить и вернуться к нему позже.
            </p>
            <Input label="Email коллег" placeholder="ivan@company.ru, maria@company.ru" />
          </div>
        )}

        <div className="mt-8 flex justify-between">
          {step > 0 ? (
            <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}>
              Назад
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit">{step === steps.length - 1 ? 'Завершить' : 'Далее'}</Button>
        </div>
      </form>
    </div>
  );
}
