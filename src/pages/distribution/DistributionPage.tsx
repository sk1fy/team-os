import { useQuery, useQueries } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useTitle } from '@reactuses/core';
import { Plus, ArrowRight } from 'lucide-react';
import { httpAuthApi as authApi } from '@/api/http';
import { distributionRuntimeApi as api, type Rule } from '@/api/distributionRuntime';
import { queryKeys } from '@/api/queryKeys';
import { Badge, Button } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { Failure, useVisiblePolling, panelClass, dateText } from './runtimeShared';
import { DistributionQueue } from './DistributionQueue';
export function DistributionPage() {
  useTitle('Распределение сделок — TeamOS');
  const navigate = useNavigate();
  const poll = useVisiblePolling();
  const user = useQuery({
    queryKey: queryKeys.distribution.runtime('actor'),
    queryFn: authApi.getCurrentUser,
  });
  const groups = useQuery({
    queryKey: queryKeys.distribution.groups,
    queryFn: ({ signal }) => api.groups(signal),
    ...poll,
  });
  const rules = useQuery({
    queryKey: queryKeys.distribution.runtime('rules'),
    queryFn: ({ signal }) => api.rules(0, signal),
    ...poll,
  });
  const connections = useQuery({
    queryKey: queryKeys.distribution.runtime('connections'),
    queryFn: ({ signal }) => api.connections(signal),
    ...poll,
  });
  const summaries = useQueries({
    queries: (groups.data ?? []).map((group) => ({
      queryKey: queryKeys.distribution.runtime('summary', group.id),
      queryFn: ({ signal }: { signal: AbortSignal }) => api.summary(group.id, signal),
      ...poll,
    })),
  });
  const availabilities = useQueries({
    queries: (rules.data?.items ?? []).map((rule) => ({
      queryKey: queryKeys.distribution.runtime('availability', rule.id),
      queryFn: ({ signal }: { signal: AbortSignal }) => api.availability(rule.id, signal),
      ...poll,
    })),
  });
  const references = useQueries({
    queries: (connections.data ?? [])
      .filter((c) => c.state === 'active')
      .map((connection) => ({
        queryKey: queryKeys.distribution.runtime('references', connection.bindingId),
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          api.references(connection.bindingId, signal),
        staleTime: 60000,
        retry: 1,
      })),
  });
  const manage = user.data?.role === 'owner' || user.data?.role === 'admin';
  const ruleFor = (groupId: string): Rule | undefined =>
    rules.data?.items.find((r) => r.groupId === groupId && r.active) ??
    rules.data?.items.find((r) => r.groupId === groupId);
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Распределение сделок"
        description="Правила, доступность сотрудников и подтверждённые результаты распределения."
        actions={
          manage ? (
            <Button onClick={() => navigate('/distribution/new')}>
              <Plus className="size-4" />
              Создать группу
            </Button>
          ) : undefined
        }
      />
      {groups.isPending && <p role="status">Загружаем группы…</p>}
      {groups.isError && <Failure error={groups.error} retry={() => void groups.refetch()} />}
      {rules.isError && <Failure error={rules.error} retry={() => void rules.refetch()} />}
      {connections.isError ? (
        <Failure error={connections.error} retry={() => void connections.refetch()} />
      ) : connections.data && !connections.data.some((c) => c.state === 'active') ? (
        <div role="status" className={panelClass}>
          amoCRM ещё не подключена. Для запуска распределения подключите аккаунт и сопоставьте
          сотрудников.
        </div>
      ) : null}
      {groups.data?.length === 0 && (
        <div className={panelClass}>
          <h2 className="text-lg font-semibold">Пока нет групп распределения</h2>
          <p className="mt-2 text-sm text-slate-500">
            Создайте группу, выберите сотрудников и этап воронки.
          </p>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {groups.data?.map((group, index) => {
          const rule = ruleFor(group.id);
          const availability = availabilities.find((_, i) => rules.data?.items[i]?.id === rule?.id);
          const summary = summaries[index];
          const activeConnections = (connections.data ?? []).filter((c) => c.state === 'active');
          const reference =
            references[activeConnections.findIndex((c) => c.bindingId === rule?.bindingId)];
          const pipeline = reference?.data?.pipelines.find((p) => p.id === rule?.pipelineId);
          return (
            <article key={group.id} className={panelClass}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{group.name}</h2>
                <Badge variant={rule?.active && group.active ? 'success' : 'neutral'}>
                  {!rule
                    ? 'Требуется настройка'
                    : rule.active && group.active
                      ? 'Работает'
                      : 'Приостановлена'}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {rule
                  ? `${pipeline?.name ?? `Воронка ${rule.pipelineId}`} · ${pipeline?.statuses.find((s) => s.id === rule.statusId)?.name ?? `Этап ${rule.statusId}`}`
                  : 'Воронка и этап не выбраны'}
              </p>
              <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-slate-500">Доступны</dt>
                  <dd className="mt-1 font-semibold">
                    {availability?.data && !availability.isError
                      ? availability.data.employees.filter((e) => e.available).length
                      : '—'}{' '}
                    / {group.memberIds.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Ожидают</dt>
                  <dd className="mt-1 font-semibold">
                    {summary?.isError ? '—' : (summary?.data?.waiting ?? '—')}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Ошибки</dt>
                  <dd className="mt-1 font-semibold">
                    {summary?.isError ? '—' : (summary?.data?.errors ?? '—')}
                  </dd>
                </div>
              </dl>
              {(summary?.isError || reference?.isError) && (
                <p role="status" className="mt-3 text-xs text-warning-700">
                  Статистика или справочник amoCRM недоступны. Данные требуют обновления.
                </p>
              )}
              {availability?.isError && (
                <p role="status" className="mt-3 text-xs text-warning-700">
                  Доступность сотрудников не получена
                </p>
              )}
              <Link
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary-700"
                to={`/distribution/${group.id}`}
              >
                Открыть группу
                <ArrowRight className="size-4" />
              </Link>
            </article>
          );
        })}
      </div>
      {groups.dataUpdatedAt > 0 && (
        <p className="text-xs text-slate-500">
          Данные групп обновлены: {dateText(new Date(groups.dataUpdatedAt).toISOString())}
        </p>
      )}
      <DistributionQueue groups={groups.data ?? []} />
    </div>
  );
}
