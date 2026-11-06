import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useTitle } from '@reactuses/core';
import { Plus } from 'lucide-react';
import { httpAuthApi as authApi } from '@/api/http';
import { distributionRuntimeApi as api } from '@/api/distributionRuntime';
import { queryKeys } from '@/api/queryKeys';
import { Button } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { useSectionTab } from '@/components/layout/chromeSlots';
import { useSectionTabCount } from '@/components/layout/tabCounts';
import { Failure, useVisiblePolling, isAccessDenied } from './runtimeShared';
import { DistributionQueue } from './DistributionQueue';
import { DistributionGroups } from './DistributionGroups';
import { DistributionJournal } from './DistributionJournal';
import { DistributionConnection } from './DistributionConnection';
import { pageClass, Problem } from './ui';

const tabKeys = ['queue', 'groups', 'journal', 'connection'] as const;
const tabTitles: Record<(typeof tabKeys)[number], string> = {
  queue: 'Очередь',
  groups: 'Группы',
  journal: 'Журнал',
  connection: 'Подключение',
};
const description = 'Правила, доступность сотрудников и подтверждённые результаты распределения.';

export function DistributionPage() {
  useTitle('Распределение сделок — TeamOS');
  const tab = useSectionTab(tabKeys, 'queue');
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
  useSectionTabCount('groups', groups.data?.length);
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
  const accessDenied = [groups.error, rules.error, connections.error, user.error].find(
    isAccessDenied,
  );
  const manage = !accessDenied && (user.data?.role === 'owner' || user.data?.role === 'admin');
  const create = () => navigate('/distribution/new');
  const header = (
    <PageHeader
      title={tabTitles[tab]}
      description={description}
      actions={
        tab === 'groups' && manage ? (
          <Button onClick={create}>
            <Plus className="size-4" aria-hidden="true" />
            Создать группу
          </Button>
        ) : undefined
      }
    />
  );
  if (accessDenied)
    return (
      <div className={pageClass}>
        {header}
        <Failure
          error={accessDenied}
          retry={() => {
            void groups.refetch();
            void rules.refetch();
            void connections.refetch();
            void user.refetch();
          }}
        />
      </div>
    );
  const notConnected = !!connections.data && !connections.data.some((c) => c.state === 'active');
  return (
    <div className={pageClass}>
      {header}
      {tab !== 'connection' &&
        (connections.isError ? (
          <Failure error={connections.error} retry={() => void connections.refetch()} />
        ) : notConnected ? (
          <Problem
            action={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate('/distribution?tab=connection')}
              >
                Подключение
              </Button>
            }
          >
            <b className="font-semibold">amoCRM ещё не подключена.</b> Для запуска распределения
            подключите аккаунт и сопоставьте сотрудников.
          </Problem>
        ) : null)}
      {groups.isError && <Failure error={groups.error} retry={() => void groups.refetch()} />}
      {rules.isError && <Failure error={rules.error} retry={() => void rules.refetch()} />}
      {tab === 'queue' && <DistributionQueue groups={groups.data ?? []} />}
      {tab === 'groups' && (
        <DistributionGroups
          groups={groups.data}
          groupsPending={groups.isPending}
          groupsUpdatedAt={groups.dataUpdatedAt}
          rules={rules.data?.items}
          connections={connections.data}
          manage={manage}
          onCreate={create}
        />
      )}
      {tab === 'journal' && (
        <DistributionJournal
          groups={groups.data}
          groupsPending={groups.isPending}
          rules={rules.data?.items}
          rulesPending={rules.isPending}
          manage={manage}
        />
      )}
      {tab === 'connection' && (
        <DistributionConnection
          connections={connections.data}
          connectionsError={connections.error}
          retryConnections={() => void connections.refetch()}
          groups={groups.data}
          rules={rules.data?.items}
        />
      )}
      {tab === 'queue' && groups.data?.length === 0 && (
        <p className="text-xs text-slate-500">
          Пока нет групп распределения: создайте группу, выберите сотрудников и этап воронки.{' '}
          <Link to="/distribution?tab=groups" className="font-semibold text-primary-700">
            К группам
          </Link>
        </p>
      )}
    </div>
  );
}
