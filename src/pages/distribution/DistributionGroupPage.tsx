import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { Activity, ArrowLeft, Clock3, Pencil, RotateCcw } from 'lucide-react';
import { distributionApi, orgApi, scheduleApi } from '@/api';
import { scheduleQueryKeys } from '@/api/queryKeys';
import type {
  DealDistributionGroup,
  DistributionAlgorithm,
  DistributionEvent,
  User,
  UserSchedule,
} from '@/types';
import { pickDistributionMember } from '@/lib/dealDistribution';
import { fullName } from '@/lib/labels';
import { toast } from '@/stores/toast';
import { Avatar, Button } from '@/components/ui';
import { ErrorState } from '@/components/layout/ErrorState';
import { DistributionGroupModal, type DistributionGroupValues } from './DistributionGroupModal';

const algorithmOptions: Array<{ value: DistributionAlgorithm; label: string }> = [
  { value: 'round_robin', label: 'По очереди' },
  { value: 'least_loaded', label: 'По наименьшей нагрузке' },
  { value: 'priority', label: 'С приоритетом' },
];

const eventStatus: Record<DistributionEvent['status'], { label: string; className: string }> = {
  accepted: { label: 'принято', className: 'bg-success-50 text-success-700' },
  in_progress: { label: 'в работе', className: 'bg-blue-50 text-blue-700' },
  reassigned: { label: 'переброс', className: 'bg-warning-50 text-warning-700' },
  declined: { label: 'отклонил', className: 'bg-danger-50 text-danger-600' },
};

function formatShift(schedule?: UserSchedule) {
  if (!schedule) return '09:00–18:00';
  return `${schedule.template.start}–${schedule.template.end}`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function todayLabel() {
  const text = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
  return `Сегодня · ${text}`;
}

function GroupSwitch({ active, onChange }: { active: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex items-center gap-2 text-sm font-semibold text-slate-600"
      aria-pressed={active}
    >
      {active ? 'Активно' : 'Приостановлено'}
      <span
        className={`flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${
          active ? 'justify-end bg-success-600' : 'justify-start bg-slate-300'
        }`}
      >
        <span className="size-5 rounded-full bg-white shadow" />
      </span>
    </button>
  );
}

function DistributionFeed({
  events,
  usersById,
  onReset,
  resetting,
}: {
  events: DistributionEvent[];
  usersById: Map<string, User>;
  onReset: () => void;
  resetting: boolean;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-surface shadow-card">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-950">Лента распределения</h2>
        <Button variant="secondary" size="sm" loading={resetting} onClick={onReset}>
          <RotateCcw className="size-3.5" />
          Сбросить
        </Button>
      </div>
      {events.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <Activity className="mx-auto size-7 text-slate-300" />
          <p className="mt-2 text-sm text-slate-400">Сделок пока не было</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {events.slice(0, 10).map((event) => {
            const user = usersById.get(event.userId);
            const status = eventStatus[event.status];
            return (
              <div
                key={event.id}
                className="grid grid-cols-[44px_62px_1fr_auto] items-center gap-2 px-4 py-3 text-sm"
              >
                <span className="text-xs text-slate-400">{formatTime(event.createdAt)}</span>
                <span className="font-semibold text-slate-700">#{event.dealNumber}</span>
                <span className="truncate text-slate-700">
                  → {user ? fullName(user) : 'Сотрудник'}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.className}`}
                >
                  {status.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function DistributionGroupPage() {
  const { groupId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const groupsQuery = useQuery({
    queryKey: ['distribution', 'groups'],
    queryFn: distributionApi.getGroups,
  });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: orgApi.getUsers });
  const schedulesQuery = useQuery({
    queryKey: scheduleQueryKeys.templates,
    queryFn: scheduleApi.getSchedules,
  });
  const eventsQuery = useQuery({
    queryKey: ['distribution', 'events', groupId],
    queryFn: () => distributionApi.getEvents(groupId),
  });

  const group = groupsQuery.data?.find((item) => item.id === groupId);
  useTitle(group ? `${group.name} — TeamOS` : 'Распределение сделок — TeamOS');

  const usersById = useMemo(
    () => new Map((usersQuery.data ?? []).map((user) => [user.id, user])),
    [usersQuery.data],
  );
  const schedulesByUser = useMemo(
    () => new Map((schedulesQuery.data ?? []).map((schedule) => [schedule.userId, schedule])),
    [schedulesQuery.data],
  );
  const events = eventsQuery.data ?? [];
  const nextMemberId = group ? pickDistributionMember(group, events) : null;

  const updateGroup = useMutation({
    mutationFn: (input: Parameters<typeof distributionApi.updateGroup>[0]) =>
      distributionApi.updateGroup(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['distribution', 'groups'] });
      const previous = queryClient.getQueryData<DealDistributionGroup[]>([
        'distribution',
        'groups',
      ]);
      queryClient.setQueryData<DealDistributionGroup[]>(['distribution', 'groups'], (groups) =>
        groups?.map((item) => (item.id === input.id ? { ...item, ...input } : item)),
      );
      return { previous };
    },
    onError: (error, _input, context) => {
      queryClient.setQueryData(['distribution', 'groups'], context?.previous);
      toast.error(error instanceof Error ? error.message : 'Не удалось обновить группу');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['distribution', 'groups'] }),
  });

  const resetEvents = useMutation({
    mutationFn: () => distributionApi.resetEvents(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distribution', 'events', groupId] });
      toast.success('Лента распределения очищена');
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Не удалось очистить ленту'),
  });

  const isLoading =
    groupsQuery.isPending ||
    usersQuery.isPending ||
    schedulesQuery.isPending ||
    eventsQuery.isPending;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 p-6">
        <div className="h-24 animate-pulse rounded-lg bg-slate-200/60" />
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="h-96 animate-pulse rounded-lg bg-slate-200/60" />
          <div className="h-72 animate-pulse rounded-lg bg-slate-200/60" />
        </div>
      </div>
    );
  }

  if (
    groupsQuery.isError ||
    usersQuery.isError ||
    schedulesQuery.isError ||
    eventsQuery.isError ||
    !group
  ) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <ErrorState
          title={group ? 'Не удалось загрузить группу' : 'Группа не найдена'}
          onRetry={() => {
            groupsQuery.refetch();
            usersQuery.refetch();
            schedulesQuery.refetch();
            eventsQuery.refetch();
          }}
        />
      </div>
    );
  }

  const members = group.memberIds.flatMap((id) => {
    const user = usersById.get(id);
    return user ? [user] : [];
  });
  const onShiftCount = members.filter(
    (user) => user.status === 'active' && !group.disabledMemberIds.includes(user.id),
  ).length;
  const todayCounts = new Map(
    members.map((user) => [
      user.id,
      events.filter((event) => event.userId === user.id && event.status !== 'declined').length,
    ]),
  );
  const maxToday = Math.max(1, ...todayCounts.values());
  const totalToday = [...todayCounts.values()].reduce((sum, value) => sum + value, 0);
  const average = members.length ? totalToday / members.length : 0;
  const minToday = members.length ? Math.min(...todayCounts.values()) : 0;
  const maxMemberToday = members.length ? Math.max(...todayCounts.values()) : 0;

  const saveGroup = (values: DistributionGroupValues) => {
    updateGroup.mutate(
      { id: group.id, ...values },
      {
        onSuccess: () => {
          setEditOpen(false);
          toast.success('Настройки группы сохранены');
        },
      },
    );
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <button
        type="button"
        onClick={() => navigate('/distribution')}
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary-700"
      >
        <ArrowLeft className="size-4" />
        Все группы
      </button>

      <section className="rounded-lg border border-slate-200 bg-surface shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={`mt-1 size-2.5 shrink-0 rounded-full ${group.active ? 'bg-success-500' : 'bg-slate-300'}`}
            />
            <div className="min-w-0">
              <h1 className="truncate text-xl">{group.name}</h1>
              <p className="mt-1 text-sm text-slate-500">
                {group.description ?? 'Автоматическое распределение новых сделок'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700">
              {todayLabel()}
            </span>
            <GroupSwitch
              active={group.active}
              onChange={() => updateGroup.mutate({ id: group.id, active: !group.active })}
            />
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="size-3.5" />
              Настройки
            </Button>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-surface-muted px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
              Алгоритм очереди
            </p>
            <div className="mt-2 inline-flex flex-wrap rounded-md border border-slate-200 bg-surface p-1">
              {algorithmOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateGroup.mutate({ id: group.id, algorithm: option.value })}
                  className={`rounded-[8px] px-3 py-1.5 text-xs font-semibold transition-colors ${
                    group.algorithm === option.value
                      ? 'bg-primary-600 text-white'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  aria-pressed={group.algorithm === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-lg border border-slate-200 bg-surface p-4 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-950">
              Очередь{' '}
              <span className="text-xs font-medium text-primary-700">
                {onShiftCount} на смене из {members.length}
              </span>
            </h2>
          </div>

          <div className="mt-4 space-y-2">
            {members.map((user, index) => {
              const today = todayCounts.get(user.id) ?? 0;
              const activeDeals = Math.min(group.dealLimit, today + ((index * 2 + 2) % 5));
              const isEnabled = !group.disabledMemberIds.includes(user.id);
              const isNext = isEnabled && user.id === nextMemberId;
              const onShift = isEnabled && user.status === 'active';
              return (
                <div
                  key={user.id}
                  className={`grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-3 py-3 sm:grid-cols-[24px_1fr_150px_54px_84px] ${
                    isNext ? 'border-primary-500 bg-primary-50/70' : 'border-slate-200 bg-surface'
                  } ${!isEnabled ? 'bg-slate-50 opacity-60' : ''}`}
                >
                  <span className="text-center text-xs font-semibold text-slate-400">
                    {index + 1}
                  </span>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={fullName(user)} src={user.avatarUrl} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {fullName(user)}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                        <span
                          className={`rounded-full px-2 py-0.5 font-semibold ${onShift ? 'bg-success-50 text-success-700' : 'bg-slate-100 text-slate-500'}`}
                        >
                          {isEnabled ? (onShift ? 'На смене' : 'Не на смене') : 'Выключен'}
                        </span>
                        <span className="text-slate-400">
                          {formatShift(schedulesByUser.get(user.id))}
                        </span>
                        {isNext && (
                          <span className="rounded-full bg-primary-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                            Следующий
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="col-start-2 row-start-2 mt-2 sm:col-auto sm:row-auto sm:mt-0">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>в работе</span>
                      <span>
                        {activeDeals} / {group.dealLimit}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-primary-600"
                        style={{
                          width: `${Math.min(100, (activeDeals / group.dealLimit) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="col-start-3 row-start-2 text-right sm:col-auto sm:row-auto">
                    <span className="block text-xl font-bold text-slate-900">{today}</span>
                    <span className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                      сегодня
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const disabledMemberIds = isEnabled
                        ? [...group.disabledMemberIds, user.id]
                        : group.disabledMemberIds.filter((id) => id !== user.id);
                      updateGroup.mutate({ id: group.id, disabledMemberIds });
                    }}
                    className="col-start-3 row-start-1 flex items-center justify-end text-slate-500 sm:col-auto sm:row-auto"
                    aria-label={`${isEnabled ? 'Выключить' : 'Включить'} сотрудника ${fullName(user)}`}
                    aria-pressed={isEnabled}
                  >
                    <span
                      className={`flex h-5 w-9 items-center rounded-full p-0.5 ${
                        isEnabled ? 'justify-end bg-primary-600' : 'justify-start bg-slate-300'
                      }`}
                    >
                      <span className="size-4 rounded-full bg-white shadow" />
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <DistributionFeed
          events={events}
          usersById={usersById}
          onReset={() => resetEvents.mutate()}
          resetting={resetEvents.isPending}
        />
      </div>

      <section className="mt-4 rounded-lg border border-slate-200 bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-950">
            Баланс распределения за сегодня{' '}
            <span className="ml-1 text-xs font-medium text-slate-400">
              сколько сделок получил каждый сегодня
            </span>
          </h2>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[190px_1fr]">
          <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
            <div className="rounded-md bg-surface-muted p-3">
              <span className="block text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                Всего сделок
              </span>
              <strong className="mt-1 block text-xl text-slate-900">{totalToday}</strong>
            </div>
            <div className="rounded-md bg-surface-muted p-3">
              <span className="block text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                В среднем
              </span>
              <strong className="mt-1 block text-xl text-slate-900">{average.toFixed(1)}</strong>
            </div>
            <div className="rounded-md bg-surface-muted p-3">
              <span className="block text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                Разница
              </span>
              <strong className="mt-1 block text-xl text-slate-900">
                {maxMemberToday - minToday}
              </strong>
            </div>
          </div>
          <div className="space-y-2">
            {members.map((user) => {
              const value = todayCounts.get(user.id) ?? 0;
              const deviation = value - average;
              const disabled = group.disabledMemberIds.includes(user.id);
              return (
                <div
                  key={user.id}
                  className={`grid grid-cols-[minmax(130px,1fr)_minmax(100px,2fr)_34px_48px] items-center gap-3 rounded-md border border-slate-100 px-3 py-2 ${
                    disabled ? 'bg-slate-50 opacity-60' : ''
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar name={fullName(user)} src={user.avatarUrl} size="xs" />
                    <span className="truncate text-xs font-medium text-slate-700">
                      {fullName(user)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${deviation > 0.5 ? 'bg-warning-500' : 'bg-primary-500'}`}
                      style={{ width: `${(value / maxToday) * 100}%` }}
                    />
                  </div>
                  <strong className="text-right text-sm text-slate-800">{value}</strong>
                  <span
                    className={`text-right text-[10px] font-semibold ${
                      deviation > 0.5
                        ? 'text-warning-600'
                        : deviation < -0.5
                          ? 'text-blue-600'
                          : 'text-slate-400'
                    }`}
                  >
                    {deviation > 0 ? '+' : ''}
                    {deviation.toFixed(1)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <p className="mt-3 flex items-center gap-1 text-xs text-slate-400">
          <Clock3 className="size-3.5" />
          Статистика обновляется после каждой распределённой сделки
        </p>
      </section>

      <DistributionGroupModal
        open={editOpen}
        group={group}
        users={usersQuery.data ?? []}
        pending={updateGroup.isPending}
        onClose={() => setEditOpen(false)}
        onSubmit={saveGroup}
      />
    </div>
  );
}
