import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { httpAuthApi as authApi, httpOrgApi as orgApi } from '@/api/http';
import { queryKeys } from '@/api/queryKeys';
import { distributionRuntimeApi as api } from '@/api/distributionRuntime';
import { Button } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { Failure, useVisiblePolling, isAccessDenied } from './runtimeShared';
import { DistributionGroupEditor } from './DistributionGroupEditor';
import { DistributionQueue } from './DistributionQueue';
import { DistributionObservations, ExecutionModeNotice } from './DistributionObservations';
import { GroupAvailability, GroupSummary } from './GroupOverview';
import { ruleForGroup } from './groupPresentation';
import { cardClass, pageClass, Problem, segButtonClass, segClass } from './ui';

export function DistributionGroupPage() {
  const { groupId } = useParams();
  const create = groupId === 'new';
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(create);
  const poll = useVisiblePolling();
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
  const users = useQuery({
    queryKey: queryKeys.distribution.runtime('users'),
    queryFn: orgApi.getUsers,
  });
  const actor = useQuery({
    queryKey: queryKeys.distribution.runtime('actor'),
    queryFn: authApi.getCurrentUser,
  });
  const settings = useQuery({
    queryKey: queryKeys.distribution.runtime('settings'),
    queryFn: ({ signal }) => api.settings(signal),
    retry: 1,
  });
  const group = groups.data?.find((g) => g.id === groupId);
  const rule = ruleForGroup(rules.data?.items, groupId);
  const binding =
    connections.data?.find((c) => c.bindingId === rule?.bindingId) ??
    (connections.data?.filter((c) => c.state === 'active').length === 1
      ? connections.data.find((c) => c.state === 'active')
      : undefined);
  const availability = useQuery({
    queryKey: queryKeys.distribution.runtime('availability', rule?.id),
    queryFn: ({ signal }) => api.availability(rule!.id, signal),
    enabled: !!rule,
    ...poll,
  });
  const errors = [groups.error, rules.error, connections.error, users.error, actor.error];
  const accessDenied = errors.find(isAccessDenied);
  const error = accessDenied ?? errors.find(Boolean);
  const loading = groups.isPending || rules.isPending || connections.isPending || users.isPending;
  const loaded = !!groups.data && !!rules.data && !!connections.data && !!users.data;
  const ready = !accessDenied && !loading && loaded && (create || !!group);
  const manage = actor.data?.role === 'owner' || actor.data?.role === 'admin';
  const groupRules = rules.data?.items.filter((r) => r.groupId === groupId) ?? [];
  return (
    <div className={pageClass}>
      <PageHeader
        title={ready ? (create ? 'Новая группа' : (group?.name ?? '')) : 'Группа распределения'}
        description={
          create
            ? 'Новая группа распределения: участники, воронка и режим.'
            : 'Группа распределения: участники, порядок и доступность по графику.'
        }
      />
      <Link
        to="/distribution?tab=groups"
        className="flex w-fit items-center text-[13px] font-semibold text-slate-600 hover:text-primary-700 dark:text-slate-300"
      >
        ← Все группы
      </Link>
      {error ? (
        <Failure
          error={error}
          retry={() => {
            void groups.refetch();
            void rules.refetch();
            void connections.refetch();
            void users.refetch();
            void actor.refetch();
          }}
        />
      ) : null}
      {accessDenied ? null : loading ? (
        <p role="status" className="py-6 text-sm text-slate-500">
          Загружаем настройки…
        </p>
      ) : !loaded ? null : !create && !group ? (
        <Problem role="alert">Группа не найдена</Problem>
      ) : (
        <>
          {group && !create && group.name.length > 22 && (
            // На телефоне длинный заголовок в шапке обрезается — полное название показываем здесь.
            <p
              aria-hidden="true"
              className="text-lg leading-snug font-semibold break-words text-ink md:hidden"
            >
              {group.name}
            </p>
          )}
          {!create && (
            <div className={segClass} role="group" aria-label="Раздел группы">
              <button
                type="button"
                aria-pressed={!settingsOpen}
                className={segButtonClass(!settingsOpen)}
                onClick={() => setSettingsOpen(false)}
              >
                Очередь группы
              </button>
              <button
                type="button"
                aria-pressed={settingsOpen}
                className={segButtonClass(settingsOpen)}
                onClick={() => setSettingsOpen(true)}
              >
                Настройки
              </button>
            </div>
          )}
          {rule && (
            <ExecutionModeNotice
              rule={rule}
              groupActive={!!group?.active}
              timezone={settings.data?.timezone}
            />
          )}
          {!create && binding?.state !== 'active' && (
            <Problem
              role="alert"
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
              Подключение amoCRM не готово. Проверьте подключение перед запуском распределения.
            </Problem>
          )}
          <div hidden={!settingsOpen}>
            {groupRules.length > 1 ? (
              <div role="alert" className={`${cardClass} space-y-3 px-5 py-[18px]`}>
                <Problem role={false}>
                  Для группы сохранено несколько правил. Требуется проверка конфигурации
                  администратором; редактор временно недоступен.
                </Problem>
                <ul className="space-y-2">
                  {groupRules.map((r) => (
                    <li key={r.id} className="text-xs break-all text-slate-600">
                      {r.id}: {r.active ? 'включено' : 'приостановлено'} · воронка {r.pipelineId},
                      этап {r.statusId}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <DistributionGroupEditor
                key={groupId}
                group={group}
                rule={rule}
                binding={binding}
                connections={connections.data ?? []}
                users={users.data ?? []}
                initialTimezone={settings.data?.timezone}
                timezoneStatus={settings.data?.timezoneStatus}
                manage={manage}
              />
            )}
          </div>
          {settings.isError && (
            <Failure error={settings.error} retry={() => void settings.refetch()} />
          )}
          {!settingsOpen && rule && group && (
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <GroupSummary group={group} rule={rule} />
              <GroupAvailability
                availability={availability}
                users={users.data ?? []}
                timezone={settings.data?.timezone}
              />
            </div>
          )}
          {!create && !settingsOpen && (
            <DistributionQueue groupId={groupId} groups={groups.data ?? []} />
          )}
          {!settingsOpen && rule && (
            <DistributionObservations
              rule={rule}
              users={users.data ?? []}
              canAssign={Boolean(
                group?.active && rule.active && rule.executionMode === 'observe' && manage,
              )}
              timezone={settings.data?.timezone}
            />
          )}
        </>
      )}
    </div>
  );
}
