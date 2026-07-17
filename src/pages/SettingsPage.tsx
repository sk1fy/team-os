import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import {
  Building2,
  CalendarDays,
  Check,
  Hash,
  ImageOff,
  Mail,
  RotateCw,
  UserRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { authApi } from '@/api';
import type { Company, User } from '@/types';
import {
  fullName,
  roleLabels,
  roleVariants,
  userStatusLabels,
  userStatusVariants,
} from '@/lib/labels';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { toast } from '@/stores/toast';
import { Avatar, Badge, Button, Input } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { ErrorState } from '@/components/layout/ErrorState';
import { PHONE_ERROR, isValidPhone } from '@/lib/formValidation';

function PreviewSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-primary-100 bg-gradient-to-br from-primary-50/80 via-surface to-surface p-4 shadow-card sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="size-14 shrink-0 animate-pulse rounded-xl bg-primary-100/80" />
          <div className="min-w-0 space-y-2">
            <div className="h-5 w-36 animate-pulse rounded bg-slate-200/80" />
            <div className="h-4 w-28 animate-pulse rounded bg-slate-200/60" />
          </div>
        </div>
        <div className="hidden h-10 w-px bg-primary-200/70 sm:block" />
        <div className="flex min-w-0 items-center gap-3 sm:justify-end">
          <div className="size-12 shrink-0 animate-pulse rounded-full bg-primary-100/80" />
          <div className="min-w-0 space-y-2">
            <div className="h-5 w-32 animate-pulse rounded bg-slate-200/80" />
            <div className="h-4 w-40 animate-pulse rounded bg-slate-200/60" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsPreview({
  company,
  user,
  loading,
  companyError,
  userError,
  onRetryCompany,
  onRetryUser,
}: {
  company?: Company;
  user?: User;
  loading: boolean;
  companyError: boolean;
  userError: boolean;
  onRetryCompany: () => void;
  onRetryUser: () => void;
}) {
  if (loading) return <PreviewSkeleton />;

  if (companyError && userError) {
    return (
      <ErrorState
        title="Не удалось загрузить настройки"
        description="Профиль компании и личные данные недоступны. Попробуйте обновить страницу."
        onRetry={() => {
          onRetryCompany();
          onRetryUser();
        }}
      />
    );
  }

  const companyName = company?.name ?? 'Компания';
  const userName = user ? fullName(user) : 'Ваш профиль';

  return (
    <div className="overflow-hidden rounded-xl border border-primary-100 bg-gradient-to-br from-primary-50/80 via-surface to-surface shadow-card">
      <div className="flex flex-col divide-y divide-primary-100/80 sm:flex-row sm:divide-x sm:divide-y-0">
        <div className="flex min-w-0 flex-1 items-center gap-3 p-4 sm:p-5">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-primary-100 bg-surface shadow-sm">
            {companyError ? (
              <Building2 className="size-6 text-primary-400" />
            ) : (
              <Avatar name={companyName} src={company?.logoUrl} size="lg" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-600">
              Компания
            </p>
            {companyError ? (
              <div className="mt-1">
                <p className="text-sm font-medium text-slate-700">Данные не загрузились</p>
                <button
                  type="button"
                  onClick={onRetryCompany}
                  className="mt-1 text-xs font-medium text-primary-600 hover:text-primary-700"
                >
                  Повторить загрузку
                </button>
              </div>
            ) : (
              <>
                <p className="truncate text-base font-semibold text-slate-900">{companyName}</p>
                {company?.createdAt && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                    <CalendarDays className="size-3.5 shrink-0" />С {formatDate(company.createdAt)}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-3 p-4 sm:p-5">
          <Avatar
            name={userName}
            src={user?.avatarUrl}
            size="lg"
            className="shrink-0 ring-2 ring-surface"
          />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-600">Вы</p>
            {userError ? (
              <div className="mt-1">
                <p className="text-sm font-medium text-slate-700">Профиль не загрузился</p>
                <button
                  type="button"
                  onClick={onRetryUser}
                  className="mt-1 text-xs font-medium text-primary-600 hover:text-primary-700"
                >
                  Повторить загрузку
                </button>
              </div>
            ) : user ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-base font-semibold text-slate-900">{userName}</p>
                  <Badge variant={roleVariants[user.role]}>{roleLabels[user.role]}</Badge>
                </div>
                <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
                  <Mail className="size-3.5 shrink-0" />
                  {user.email}
                </p>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

type FormPanelProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  busy?: boolean;
  dirty?: boolean;
  children: ReactNode;
};

function FormPanel({ icon: Icon, title, description, busy, dirty, children }: FormPanelProps) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border bg-surface shadow-card transition-colors',
        dirty ? 'border-primary-200 ring-1 ring-primary-100' : 'border-slate-200',
      )}
    >
      <header className="flex items-start gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {busy && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                <RotateCw className="size-3 animate-spin" />
                Загрузка
              </span>
            )}
            {dirty && !busy && (
              <span className="rounded-full bg-warning-50 px-2 py-0.5 text-[11px] font-medium text-warning-700">
                Есть изменения
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-slate-500">{description}</p>
        </div>
      </header>
      <div className="px-4 py-4 sm:px-5 sm:py-5">{children}</div>
    </section>
  );
}

function MetaItem({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-surface-muted/60 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        <Icon className="size-3.5" />
        {label}
      </p>
      <div className="mt-1 text-sm text-slate-700">{children}</div>
    </div>
  );
}

function ImageField({
  label,
  hint,
  value,
  previewName,
  onChange,
  onClear,
  disabled,
  placeholder,
}: {
  label: string;
  hint: string;
  value: string;
  previewName: string;
  onChange: (value: string) => void;
  onClear: () => void;
  disabled?: boolean;
  placeholder: string;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="flex items-center gap-3 sm:flex-col sm:items-center sm:gap-2">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-xl border border-primary-100 bg-primary-50/50 p-1.5">
          <Avatar name={previewName} src={value || undefined} size="lg" />
        </div>
        <span className="text-xs text-slate-400 sm:text-center">{label}</span>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <Input
          label={`Ссылка на ${label.toLowerCase()}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          hint={hint}
          disabled={disabled}
        />
        {value && <ClearImageButton onClick={onClear} disabled={disabled} />}
      </div>
    </div>
  );
}

function ClearImageButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-danger-600 disabled:cursor-not-allowed disabled:text-slate-300"
    >
      <ImageOff className="size-3.5" />
      Убрать изображение
    </button>
  );
}

function SaveBar({
  isDirty,
  isSaving,
  savedAt,
  label,
}: {
  isDirty: boolean;
  isSaving: boolean;
  savedAt: number | null;
  label: string;
}) {
  return (
    <div className="sticky bottom-0 -mx-4 mt-5 flex flex-col gap-3 border-t border-slate-100 bg-surface/95 px-4 py-3 backdrop-blur-sm sm:-mx-5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-xs leading-5 text-slate-500">
        {isSaving ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
            <RotateCw className="size-3.5 animate-spin" />
            Сохраняем {label}…
          </span>
        ) : savedAt && !isDirty ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-success-700">
            <Check className="size-3.5" />
            {label} сохранён
          </span>
        ) : isDirty ? (
          <span className="font-medium text-warning-700">Изменения ещё не сохранены</span>
        ) : (
          'Все данные актуальны'
        )}
      </p>
      <Button
        type="submit"
        loading={isSaving}
        disabled={!isDirty || isSaving}
        className="w-full sm:w-auto"
      >
        Сохранить
      </Button>
    </div>
  );
}

function CompanyProfileSection() {
  const queryClient = useQueryClient();
  const companyQuery = useQuery({ queryKey: ['company'], queryFn: authApi.getCompany });

  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [amoAccountId, setAmoAccountId] = useState('');
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (companyQuery.data) {
      setName(companyQuery.data.name);
      setLogoUrl(companyQuery.data.logoUrl ?? '');
      setAmoAccountId(companyQuery.data.amoAccountId ?? '');
    }
  }, [companyQuery.data]);

  const isDirty = useMemo(() => {
    const data = companyQuery.data;
    if (!data) return false;
    return (
      name.trim() !== data.name ||
      (logoUrl.trim() || '') !== (data.logoUrl ?? '') ||
      (amoAccountId.trim() || '') !== (data.amoAccountId ?? '')
    );
  }, [companyQuery.data, name, logoUrl, amoAccountId]);

  const save = useMutation({
    mutationFn: () =>
      authApi.updateCompany({
        name: name.trim(),
        logoUrl: logoUrl.trim(),
        amoAccountId: amoAccountId.trim(),
      }),
    onSuccess: (company) => {
      queryClient.setQueryData(['company'], company);
      queryClient.invalidateQueries({ queryKey: ['company'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSavedAt(Date.now());
      toast.success('Название и логотип компании обновлены');
    },
    onError: () => toast.error('Не удалось сохранить данные компании'),
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.error('Укажите название компании');
      return;
    }
    save.mutate();
  };

  const busy = companyQuery.isPending;
  const previewName = name.trim() || 'Компания';

  if (companyQuery.isError) {
    return (
      <ErrorState
        title="Профиль компании недоступен"
        description="Не удалось получить данные компании. Проверьте соединение и попробуйте снова."
        onRetry={() => companyQuery.refetch()}
      />
    );
  }

  return (
    <FormPanel
      icon={Building2}
      title="Профиль компании"
      description="Название и логотип отображаются в интерфейсе для всей команды."
      busy={busy}
      dirty={isDirty}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <ImageField
          label="Логотип"
          hint="Вставьте прямую ссылку на квадратное изображение. Загрузка файлов появится позже."
          value={logoUrl}
          previewName={previewName}
          onChange={setLogoUrl}
          onClear={() => setLogoUrl('')}
          disabled={busy}
          placeholder="https://example.com/logo.png"
        />

        <Input
          label="Название компании"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ромашка Digital"
          hint="Используется в шапке, уведомлениях и приглашениях."
          required
          disabled={busy}
        />

        <Input
          label="amoCRM Account ID"
          value={amoAccountId}
          onChange={(event) => setAmoAccountId(event.target.value)}
          placeholder="31355990"
          hint="ID аккаунта amoCRM для интеграции сотрудников и сделок."
          disabled={busy}
        />

        {companyQuery.data && (
          <div className="grid gap-3 sm:grid-cols-2">
            <MetaItem icon={CalendarDays} label="Создана">
              {formatDate(companyQuery.data.createdAt)}
            </MetaItem>
            <MetaItem icon={Hash} label="ID компании">
              <span className="break-all font-mono text-xs text-slate-600">
                {companyQuery.data.id}
              </span>
            </MetaItem>
          </div>
        )}

        <SaveBar isDirty={isDirty} isSaving={save.isPending} savedAt={savedAt} label="Компания" />
      </form>
    </FormPanel>
  );
}

function MyProfileSection() {
  const queryClient = useQueryClient();
  const userQuery = useQuery({ queryKey: ['currentUser'], queryFn: authApi.getCurrentUser });

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [phoneError, setPhoneError] = useState<string>();

  useEffect(() => {
    if (userQuery.data) {
      setFirstName(userQuery.data.firstName);
      setLastName(userQuery.data.lastName);
      setPhone(userQuery.data.phone ?? '');
      setAvatarUrl(userQuery.data.avatarUrl ?? '');
    }
  }, [userQuery.data]);

  const isDirty = useMemo(() => {
    const data = userQuery.data;
    if (!data) return false;
    return (
      firstName.trim() !== data.firstName ||
      lastName.trim() !== data.lastName ||
      (phone.trim() || '') !== (data.phone ?? '') ||
      (avatarUrl.trim() || '') !== (data.avatarUrl ?? '')
    );
  }, [userQuery.data, firstName, lastName, phone, avatarUrl]);

  const save = useMutation({
    mutationFn: () =>
      authApi.updateCurrentUser({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        avatarUrl: avatarUrl.trim(),
      }),
    onSuccess: (user) => {
      queryClient.setQueryData(['currentUser'], user);
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSavedAt(Date.now());
      toast.success('Личные данные обновлены');
    },
    onError: () => toast.error('Не удалось сохранить личные данные'),
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('Заполните имя и фамилию');
      return;
    }
    if (!isValidPhone(phone)) {
      setPhoneError(PHONE_ERROR);
      return;
    }
    save.mutate();
  };

  const busy = userQuery.isPending;
  const displayName =
    firstName || lastName
      ? `${firstName} ${lastName}`.trim()
      : userQuery.data
        ? fullName(userQuery.data)
        : 'Профиль';

  if (userQuery.isError) {
    return (
      <ErrorState
        title="Личный профиль недоступен"
        description="Не удалось загрузить ваши данные. Попробуйте обновить страницу."
        onRetry={() => userQuery.refetch()}
      />
    );
  }

  return (
    <FormPanel
      icon={UserRound}
      title="Мой профиль"
      description="Имя, контакты и фото — то, как вас видят коллеги в TeamOS."
      busy={busy}
      dirty={isDirty}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <ImageField
          label="Аватар"
          hint="Ссылка на фото профиля. Если поле пустое, покажем инициалы."
          value={avatarUrl}
          previewName={displayName}
          onChange={setAvatarUrl}
          onClear={() => setAvatarUrl('')}
          disabled={busy}
          placeholder="https://example.com/avatar.png"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Имя"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Анна"
            required
            disabled={busy}
          />
          <Input
            label="Фамилия"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Иванова"
            required
            disabled={busy}
          />
        </div>

        <Input
          label="Телефон"
          type="tel"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setPhoneError(undefined);
          }}
          placeholder="+7 900 000-00-00"
          hint="Необязательно. Поможет коллегам связаться с вами."
          disabled={busy}
          error={phoneError}
        />

        {userQuery.data && (
          <div className="grid gap-3 sm:grid-cols-2">
            <MetaItem icon={Mail} label="Email">
              <p>{userQuery.data.email}</p>
              <p className="mt-1 text-xs text-slate-500">
                Изменить email можно только через поддержку.
              </p>
            </MetaItem>
            <MetaItem icon={UserRound} label="Роль">
              <Badge variant={roleVariants[userQuery.data.role]}>
                {roleLabels[userQuery.data.role]}
              </Badge>
              <p className="mt-1.5 text-xs text-slate-500">Назначается администратором компании.</p>
            </MetaItem>
            <MetaItem icon={Check} label="Статус">
              <Badge variant={userStatusVariants[userQuery.data.status]}>
                {userStatusLabels[userQuery.data.status]}
              </Badge>
            </MetaItem>
            <MetaItem icon={CalendarDays} label="В TeamOS с">
              {formatDate(userQuery.data.createdAt)}
            </MetaItem>
          </div>
        )}

        <SaveBar isDirty={isDirty} isSaving={save.isPending} savedAt={savedAt} label="Профиль" />
      </form>
    </FormPanel>
  );
}

export function SettingsPage() {
  useTitle('Настройки — TeamOS');

  const companyQuery = useQuery({ queryKey: ['company'], queryFn: authApi.getCompany });
  const userQuery = useQuery({ queryKey: ['currentUser'], queryFn: authApi.getCurrentUser });

  const previewLoading = companyQuery.isPending || userQuery.isPending;
  const readOnly = userQuery.data?.role === 'employee';

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <PageHeader
        title="Настройки"
        description="Управляйте представлением компании и своими личными данными в одном месте."
      />

      <div className="mt-5">
        <SettingsPreview
          company={companyQuery.data}
          user={userQuery.data}
          loading={previewLoading}
          companyError={companyQuery.isError}
          userError={userQuery.isError}
          onRetryCompany={() => companyQuery.refetch()}
          onRetryUser={() => userQuery.refetch()}
        />
      </div>

      <div className="mt-5 space-y-5 sm:mt-6 sm:space-y-6">
        {readOnly ? (
          <div className="rounded-xl border border-slate-200 bg-surface p-5 text-sm text-slate-600 shadow-card">
            Профиль доступен только для просмотра. Изменения вносит владелец или администратор
            компании.
          </div>
        ) : (
          <>
            <CompanyProfileSection />
            <MyProfileSection />
          </>
        )}
      </div>
    </div>
  );
}
