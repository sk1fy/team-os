import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Info } from 'lucide-react';
import { httpOrgApi as orgApi } from '@/api/http';
import { queryKeys } from '@/api/queryKeys';
import { distributionRuntimeApi as api, type Group, type Rule } from '@/api/distributionRuntime';
import { Select } from '@/components/ui';
import { cn } from '@/lib/cn';
import { DistributionObservations, ExecutionModeNotice } from './DistributionObservations';
import { Failure } from './runtimeShared';
import { groupStatus, ruleForGroup } from './groupPresentation';
import { cardClass, Pill } from './ui';

/**
 * Вкладка «Журнал». Общего журнала по всем группам в API нет: журнал наблюдений
 * ведётся по правилу группы, поэтому группа выбирается здесь (параметр `group`).
 */
export function DistributionJournal({
  groups,
  groupsPending,
  rules,
  rulesPending,
  manage,
}: {
  groups: Group[] | undefined;
  groupsPending: boolean;
  rules: Rule[] | undefined;
  rulesPending: boolean;
  manage: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const users = useQuery({
    queryKey: queryKeys.distribution.runtime('users'),
    queryFn: orgApi.getUsers,
  });
  const settings = useQuery({
    queryKey: queryKeys.distribution.runtime('settings'),
    queryFn: ({ signal }) => api.settings(signal),
    retry: 1,
  });
  if (groupsPending || rulesPending)
    return (
      <p role="status" className="py-6 text-sm text-slate-500">
        Загружаем журнал…
      </p>
    );
  if (!groups?.length)
    return (
      <section className={cn(cardClass, 'px-5 py-11 text-center')}>
        <h2 className="text-[15px] font-semibold text-ink">Журнал пока пуст</h2>
        <p className="mt-1.5 text-sm text-slate-500">
          Журнал ведётся по группам распределения. Создайте группу на вкладке «Группы».
        </p>
      </section>
    );
  const requested = groups.find((g) => g.id === params.get('group'));
  const group = requested ?? groups.find((g) => ruleForGroup(rules, g.id)) ?? groups[0]!;
  const rule = ruleForGroup(rules, group.id);
  const status = groupStatus(group, rule);
  const choose = (id: string) => {
    const next = new URLSearchParams(params);
    next.set('group', id);
    next.delete('observationsOffset');
    setParams(next);
  };
  return (
    <div className="space-y-4">
      <section
        className={cn(
          cardClass,
          'flex flex-wrap items-end justify-between gap-x-4 gap-y-3 px-5 py-4',
        )}
        aria-label="Группа журнала"
      >
        <Select
          label="Группа"
          className="w-full sm:w-80"
          value={group.id}
          onValueChange={choose}
          options={groups.map((g) => ({ value: g.id, label: g.name }))}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Pill tone={status.tone}>{status.label}</Pill>
          <Link
            to={`/distribution/${group.id}`}
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink hover:text-primary-700"
          >
            Открыть группу
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <p className="flex basis-full items-start gap-2 text-xs text-slate-500">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          Журнал ведётся по правилу группы: предварительные решения и ручные назначения. История
          отдельной сделки — в её карточке на вкладке «Очередь».
        </p>
      </section>
      {settings.isError && <Failure error={settings.error} retry={() => void settings.refetch()} />}
      {users.isError && <Failure error={users.error} retry={() => void users.refetch()} />}
      {rule ? (
        <>
          <ExecutionModeNotice
            rule={rule}
            groupActive={group.active}
            timezone={settings.data?.timezone}
          />
          <DistributionObservations
            key={rule.id}
            rule={rule}
            users={users.data ?? []}
            canAssign={Boolean(
              group.active && rule.active && rule.executionMode === 'observe' && manage,
            )}
            timezone={settings.data?.timezone}
          />
        </>
      ) : (
        <section className={cn(cardClass, 'px-5 py-11 text-center')}>
          <h2 className="text-[15px] font-semibold text-ink">У группы нет правила распределения</h2>
          <p className="mt-1.5 text-sm text-slate-500">
            Журнал появится после настройки воронки и режима в группе.
          </p>
        </section>
      )}
    </div>
  );
}
