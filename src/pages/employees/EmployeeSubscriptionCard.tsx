import { useMemo, useState } from 'react';
import { Minus, Plus, Users } from 'lucide-react';
import type { User } from '@/types';
import { Badge, Button, Drawer } from '@/components/ui';
import { toast } from '@/stores/toast';
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

export function EmployeeSubscriptionCard({ users }: { users: User[] }) {
  const [action, setAction] = useState<BillingAction>(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [renewalUsers, setRenewalUsers] = useState(BASIC_INCLUDED_USERS);
  const purchasedUsers: number = BASIC_INCLUDED_USERS;
  const usedUsers = countActiveEmployees(users);
  const progress =
    purchasedUsers === 0 ? 0 : Math.min(100, Math.round((usedUsers / purchasedUsers) * 100));
  const paidUntilLabel = paidUntilFormatter.format(new Date(PAID_UNTIL));
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
            ? `Текущий доступ действует до ${paidUntilLabel}`
            : 'Продление Базового тарифа на 1 год'
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
        <div className="rounded-lg border border-primary-200 bg-primary-50 p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-md bg-white text-primary-600 shadow-card">
              <Users className="size-4.5" />
            </span>
            <div>
              <p className="font-semibold text-ink">Базовый</p>
              <p className="text-xs text-slate-500">
                {isPurchase ? `${purchasedUsers} пользователей куплено` : 'Доступ на 1 год'}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-base">
            {isPurchase ? 'Количество дополнительных пользователей' : 'Количество пользователей'}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {isPurchase
              ? 'Выберите, сколько пользователей хотите добавить.'
              : 'В Базовый тариф включено минимум 5 пользователей.'}
          </p>
          <div className="mt-4">
            {isPurchase ? (
              <QuantityControl
                value={purchaseQuantity}
                minimum={1}
                onChange={setPurchaseQuantity}
              />
            ) : (
              <QuantityControl
                value={renewalUsers}
                minimum={BASIC_INCLUDED_USERS}
                onChange={setRenewalUsers}
              />
            )}
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 bg-surface-muted p-5">
          <p className="text-sm text-slate-500">К оплате</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-primary-700">
            {currencyFormatter.format(finalTotal)}
          </p>
        </div>
      </Drawer>
    </>
  );
}
