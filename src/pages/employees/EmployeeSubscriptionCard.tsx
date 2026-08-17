import { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Minus, Plus, Users } from 'lucide-react';
import type { User } from '@/types';
import { Badge, Button, Drawer } from '@/components/ui';
import { toast } from '@/stores/toast';
import { plural } from '@/lib/format';
import {
  additionalUsersPrice,
  basicRenewalPrice,
  BASIC_INCLUDED_USERS,
} from './subscriptionPricing';
import { countActiveEmployees } from './employeeActivation';

const PAID_UNTIL = '2027-07-14T00:00:00Z';
const currencyFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});
const paidUntilFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function addYear(value: string): Date {
  const date = new Date(value);
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date;
}

type BillingAction = 'purchase' | 'renew' | null;

function QuantityControl({
  value,
  minimum,
  onChange,
}: {
  value: number;
  minimum: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-surface">
      <button
        type="button"
        aria-label="Уменьшить количество пользователей"
        disabled={value <= minimum}
        onClick={() => onChange(Math.max(minimum, value - 1))}
        className="flex size-10 items-center justify-center text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
      >
        <Minus className="size-4" />
      </button>
      <span className="flex min-w-14 items-center justify-center border-x border-slate-200 px-3 text-base font-semibold text-ink">
        {value}
      </span>
      <button
        type="button"
        aria-label="Увеличить количество пользователей"
        onClick={() => onChange(value + 1)}
        className="flex size-10 items-center justify-center text-primary-600 transition-colors hover:bg-primary-50"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-surface px-3 py-2.5">
      <p className="text-[11px] font-medium tracking-wide text-slate-400 uppercase">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}

export function EmployeeSubscriptionCard({ users }: { users: User[] }) {
  const [action, setAction] = useState<BillingAction>(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [renewalUsers, setRenewalUsers] = useState(BASIC_INCLUDED_USERS);
  const purchasedUsers: number = BASIC_INCLUDED_USERS;
  const usedUsers = countActiveEmployees(users);
  const progress =
    purchasedUsers === 0 ? 0 : Math.min(100, Math.round((usedUsers / purchasedUsers) * 100));
  const availableUsers = Math.max(0, purchasedUsers - usedUsers);
  const paidUntilLabel = paidUntilFormatter.format(new Date(PAID_UNTIL));
  const renewedUntilLabel = paidUntilFormatter.format(addYear(PAID_UNTIL));
  const purchaseTotal = useMemo(
    () => additionalUsersPrice(PAID_UNTIL, purchaseQuantity),
    [purchaseQuantity],
  );
  const renewalTotal = useMemo(() => basicRenewalPrice(renewalUsers), [renewalUsers]);
  const isPurchase = action === 'purchase';
  const finalTotal = isPurchase ? purchaseTotal : renewalTotal;

  const finishPayment = () => {
    toast.success('Счёт на оплату сформирован');
    setAction(null);
  };

  return (
    <>
      <section className="mt-5 rounded-lg border border-slate-200 border-l-primary-500 bg-surface p-5 shadow-card">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="min-w-[230px]">
            <div className="flex items-center gap-2">
              <Badge variant="primary">Базовый</Badge>
              <span className="text-sm font-semibold text-ink">Тариф и доступ</span>
            </div>
            <p className="mt-2 text-sm text-slate-500">Доступ оплачен до {paidUntilLabel}</p>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-ink">{purchasedUsers} пользователей</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Используется {usedUsers} из {purchasedUsers}
                </p>
              </div>
              <span className="text-xs font-medium text-slate-500">{progress}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-primary-600 transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" onClick={() => setAction('purchase')}>
              Докупить
            </Button>
            <Button onClick={() => setAction('renew')}>Продлить</Button>
          </div>
        </div>
      </section>

      <Drawer
        open={action !== null}
        onOpenChange={(open) => !open && setAction(null)}
        title={isPurchase ? 'Докупить пользователей' : 'Продлить доступ'}
        description={
          isPurchase
            ? `Новые места будут доступны до ${paidUntilLabel}`
            : 'Базовый тариф · продление на 1 год'
        }
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAction(null)}>
              Отмена
            </Button>
            <Button disabled={finalTotal <= 0} onClick={finishPayment}>
              Оплатить {currencyFormatter.format(finalTotal)}
            </Button>
          </>
        }
      >
        {isPurchase ? (
          <>
            <div className="rounded-lg border border-primary-200 bg-primary-50 p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-md bg-white text-primary-600 shadow-card">
                  <Users className="size-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-ink">Базовый</p>
                    <Badge variant="primary">до {paidUntilLabel}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Дополнительные места подключаются на оставшийся срок тарифа
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <Metric label="Куплено" value={purchasedUsers} />
              <Metric label="Активно" value={usedUsers} />
              <Metric label="Свободно" value={availableUsers} />
            </div>

            <div className="mt-6">
              <h3 className="text-base">Сколько мест добавить</h3>
              <p className="mt-1 text-sm text-slate-500">
                После оплаты их можно сразу назначить сотрудникам в таблице.
              </p>
              <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-surface p-4">
                <QuantityControl
                  value={purchaseQuantity}
                  minimum={1}
                  onChange={setPurchaseQuantity}
                />
                <div className="text-right">
                  <p className="text-xs text-slate-500">После покупки</p>
                  <p className="mt-0.5 text-sm font-semibold text-ink">
                    {purchasedUsers + purchaseQuantity} мест · свободно{' '}
                    {availableUsers + purchaseQuantity}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-lg border border-primary-200 bg-primary-50/70 p-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500">Итого к оплате</p>
                  <p className="mt-1 text-xs text-slate-400">
                    За {purchaseQuantity}{' '}
                    {plural(purchaseQuantity, [
                      'дополнительное место',
                      'дополнительных места',
                      'дополнительных мест',
                    ])}
                  </p>
                </div>
                <p
                  aria-live="polite"
                  className="text-3xl font-semibold tracking-tight text-primary-700"
                >
                  {currencyFormatter.format(purchaseTotal)}
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-lg border border-primary-200 bg-primary-50 p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-md bg-white text-primary-600 shadow-card">
                  <CalendarDays className="size-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-ink">Базовый</p>
                    <Badge variant="primary">1 год</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Продление начнётся после окончания текущего периода
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-slate-200 bg-surface p-4">
              <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                Срок доступа
              </p>
              <div className="mt-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500">Сейчас до</p>
                  <p className="mt-0.5 font-semibold text-ink">{paidUntilLabel}</p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-primary-500" />
                <div className="min-w-0 flex-1 text-right">
                  <p className="text-xs text-slate-500">После продления</p>
                  <p className="mt-0.5 font-semibold text-primary-700">{renewedUntilLabel}</p>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-base">Количество пользователей</h3>
              <p className="mt-1 text-sm text-slate-500">
                В Базовый тариф включено минимум 5 пользователей.
              </p>
              <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-surface p-4">
                <QuantityControl
                  value={renewalUsers}
                  minimum={BASIC_INCLUDED_USERS}
                  onChange={setRenewalUsers}
                />
                <div className="text-right">
                  <p className="text-xs text-slate-500">Продление</p>
                  <p className="mt-0.5 text-sm font-semibold text-ink">
                    {renewalUsers} пользователей · 1 год
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-lg border border-primary-200 bg-primary-50/70 p-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500">Итого к оплате</p>
                  <p className="mt-1 text-xs text-slate-400">Базовый тариф на 1 год</p>
                </div>
                <p
                  aria-live="polite"
                  className="text-3xl font-semibold tracking-tight text-primary-700"
                >
                  {currencyFormatter.format(renewalTotal)}
                </p>
              </div>
            </div>
          </>
        )}
      </Drawer>
    </>
  );
}
