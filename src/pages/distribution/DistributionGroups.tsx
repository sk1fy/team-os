import { useQueries, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Plus } from 'lucide-react';
import { httpOrgApi as orgApi } from '@/api/http';
import { queryKeys } from '@/api/queryKeys';
import {
  distributionRuntimeApi as api,
  type Connection,
  type Group,
  type Rule,
} from '@/api/distributionRuntime';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import { dateText, useVisiblePolling } from './runtimeShared';
import { funnelText, groupStatus, ruleForGroup } from './groupPresentation';
import { AvatarStack, cardClass, Pill } from './ui';

/** Вкладка «Группы»: карточки групп распределения (`.org` в концепте). */
export function DistributionGroups({
  groups,
  groupsPending,
  groupsUpdatedAt,
  rules,
  connections,
  manage,
  onCreate,
}: {
  groups: Group[] | undefined;
  groupsPending: boolean;
  groupsUpdatedAt: number;
  rules: Rule[] | undefined;
  connections: Connection[] | undefined;
  manage: boolean;
  onCreate: () => void;
}) {
  const poll = useVisiblePolling();
  const users = useQuery({
    queryKey: queryKeys.distribution.runtime('users'),
    queryFn: orgApi.getUsers,
  });
  const summaries = useQueries({
    queries: (groups ?? []).map((group) => ({
      queryKey: queryKeys.distribution.runtime('summary', group.id),
      queryFn: ({ signal }: { signal: AbortSignal }) => api.summary(group.id, signal),
      ...poll,
    })),
  });
  const availabilities = useQueries({
    queries: (rules ?? []).map((rule) => ({
      queryKey: queryKeys.distribution.runtime('availability', rule.id),
      queryFn: ({ signal }: { signal: AbortSignal }) => api.availability(rule.id, signal),
      ...poll,
    })),
  });
  const activeConnections = (connections ?? []).filter((c) => c.state === 'active');
  const references = useQueries({
    queries: activeConnections.map((connection) => ({
      queryKey: queryKeys.distribution.runtime('references', connection.bindingId),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api.references(connection.bindingId, signal),
      staleTime: 60000,
      retry: 1,
    })),
  });

  if (groupsPending)
    return (
      <p role="status" className="py-6 text-sm text-slate-500">
        Загружаем группы…
      </p>
    );
  if (groups?.length === 0)
    return (
      <section className={cn(cardClass, 'px-5 py-11 text-center')}>
        <h2 className="text-[15px] font-semibold text-ink">Пока нет групп распределения</h2>
        <p className="mt-1.5 text-sm text-slate-500">
          Создайте группу, выберите сотрудников и этап воронки.
        </p>
        {manage && (
          <Button className="mt-4" size="sm" onClick={onCreate}>
            <Plus className="size-4" aria-hidden="true" />
            Создать группу
          </Button>
        )}
      </section>
    );
  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3.5">
        {groups?.map((group, index) => {
          const rule = ruleForGroup(rules, group.id);
          const availability = availabilities.find((_, i) => rules?.[i]?.id === rule?.id);
          const summary = summaries[index];
          const reference =
            references[activeConnections.findIndex((c) => c.bindingId === rule?.bindingId)];
          const status = groupStatus(group, rule);
          const errors = summary?.isError ? null : summary?.data?.errors;
          return (
            <section
              key={group.id}
              className={cn(
                cardClass,
                'relative flex min-w-0 flex-col px-5 py-[18px] transition-colors hover:border-slate-300 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-primary-600',
              )}
            >
              <div className="flex items-start justify-between gap-2.5">
                <h2 className="min-w-0 text-base font-semibold break-words text-ink">
                  {group.name}
                </h2>
                <Pill tone={status.tone}>{status.label}</Pill>
              </div>
              <p className="mt-1 text-[13px] break-words text-slate-500">
                {funnelText(rule, reference?.data?.pipelines)}
              </p>
              <dl className="my-4 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-[13px] text-slate-500">Доступны</dt>
                  <dd className="mt-0.5 font-semibold text-ink">
                    {availability?.data && !availability.isError
                      ? availability.data.employees.filter((e) => e.available).length
                      : '—'}{' '}
                    / {group.memberIds.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-[13px] text-slate-500">Ожидают</dt>
                  <dd className="mt-0.5 font-semibold text-ink">
                    {summary?.isError ? '—' : (summary?.data?.waiting ?? '—')}
                  </dd>
                </div>
                <div>
                  <dt className="text-[13px] text-slate-500">Ошибки</dt>
                  <dd
                    className={cn(
                      'mt-0.5 font-semibold',
                      errors ? 'text-danger-700 dark:text-red-300' : 'text-ink',
                    )}
                  >
                    {errors ?? '—'}
                  </dd>
                </div>
              </dl>
              {(summary?.isError || reference?.isError) && (
                <p role="status" className="-mt-1 mb-3 text-xs text-warning-700">
                  Статистика или справочник amoCRM недоступны. Данные требуют обновления.
                </p>
              )}
              {availability?.isError && (
                <p role="status" className="-mt-1 mb-3 text-xs text-warning-700">
                  Доступность сотрудников не получена
                </p>
              )}
              <div className="mt-auto flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <AvatarStack ids={group.memberIds} users={users.data ?? []} />
                  <span className="text-xs text-slate-500">
                    {group.memberIds.length} {participants(group.memberIds.length)}
                  </span>
                </div>
                <Link
                  to={`/distribution/${group.id}`}
                  aria-label={`Открыть группу ${group.name}`}
                  className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-ink after:absolute after:inset-0 after:rounded-xl hover:text-primary-700 focus-visible:outline-none"
                >
                  Открыть
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </section>
          );
        })}
      </div>
      {groupsUpdatedAt > 0 && (
        <p className="text-xs text-slate-500">
          Данные групп обновлены: {dateText(new Date(groupsUpdatedAt).toISOString())}
        </p>
      )}
    </>
  );
}

function participants(count: number) {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 > 10 && mod100 < 20) return 'участников';
  if (mod10 === 1) return 'участник';
  if (mod10 > 1 && mod10 < 5) return 'участника';
  return 'участников';
}
