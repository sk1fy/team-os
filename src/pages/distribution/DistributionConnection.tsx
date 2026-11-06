import { useQuery } from '@tanstack/react-query';
import { httpOrgApi as orgApi } from '@/api/http';
import { queryKeys } from '@/api/queryKeys';
import {
  distributionRuntimeApi as api,
  type Connection,
  type Group,
  type Mapping,
  type Rule,
} from '@/api/distributionRuntime';
import { cn } from '@/lib/cn';
import { fullName } from '@/lib/labels';
import type { User } from '@/types';
import { dateText, Failure } from './runtimeShared';
import { Card, DefinitionList, PersonAvatar, Pill, Problem, type PillTone } from './ui';

const connectionStates: Record<Connection['state'], { label: string; tone: PillTone }> = {
  active: { label: 'Подключено', tone: 'green' },
  pending: { label: 'Ожидает подтверждения', tone: 'amber' },
  revoked: { label: 'Недоступно', tone: 'red' },
};

const mappingStates: Record<Mapping['state'], { label: string; tone: PillTone }> = {
  verified: { label: 'Связь подтверждена', tone: 'green' },
  unavailable: { label: 'Пользователь недоступен', tone: 'amber' },
  ambiguous: { label: 'Неоднозначная связь', tone: 'amber' },
};

const timezoneStates = {
  confirmed: 'подтверждён amoCRM',
  cached: 'последний подтверждённый, обновление временно недоступно',
  unavailable: 'не подтверждён',
} as const;

/** Вкладка «Подключение»: установки amoCRM, время аккаунта и связи сотрудников. */
export function DistributionConnection({
  connections,
  connectionsError,
  retryConnections,
  groups,
  rules,
}: {
  connections: Connection[] | undefined;
  connectionsError: unknown;
  retryConnections: () => void;
  groups: Group[] | undefined;
  rules: Rule[] | undefined;
}) {
  const users = useQuery({
    queryKey: queryKeys.distribution.runtime('users'),
    queryFn: orgApi.getUsers,
  });
  const settings = useQuery({
    queryKey: queryKeys.distribution.runtime('settings'),
    queryFn: ({ signal }) => api.settings(signal),
    retry: 1,
  });
  if (connectionsError) return <Failure error={connectionsError} retry={retryConnections} />;
  if (!connections)
    return (
      <p role="status" className="py-6 text-sm text-slate-500">
        Загружаем подключения…
      </p>
    );
  const hasActive = connections.some((c) => c.state === 'active');
  return (
    <div className="space-y-4">
      {!hasActive && (
        <Problem>
          <b className="font-semibold">amoCRM ещё не подключена.</b> Для запуска распределения
          подключите аккаунт и сопоставьте сотрудников.
        </Problem>
      )}
      {connections.length === 0 ? (
        <Card title="Подключения amoCRM">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Нет подключённых установок. Обратитесь к администратору сервиса для подключения amoCRM.
          </p>
        </Card>
      ) : (
        connections.map((connection) => (
          <ConnectionBlock
            key={connection.bindingId}
            connection={connection}
            users={users.data ?? []}
            groups={groups ?? []}
            rules={rules ?? []}
            timezone={settings.data?.timezone}
          />
        ))
      )}
      {settings.isError ? (
        <Failure error={settings.error} retry={() => void settings.refetch()} />
      ) : (
        settings.data && (
          <p className="text-xs text-slate-500">
            Время аккаунта amoCRM: {settings.data.timezone || 'не указано'}
            {settings.data.timezoneStatus
              ? ` — ${timezoneStates[settings.data.timezoneStatus]}`
              : ''}
            . Сегодняшняя статистика и смены считаются в этом часовом поясе.
          </p>
        )
      )}
    </div>
  );
}

function ConnectionBlock({
  connection,
  users,
  groups,
  rules,
  timezone,
}: {
  connection: Connection;
  users: User[];
  groups: Group[];
  rules: Rule[];
  timezone?: string;
}) {
  const active = connection.state === 'active';
  const refs = useQuery({
    queryKey: queryKeys.distribution.runtime('references', connection.bindingId),
    queryFn: ({ signal }) => api.references(connection.bindingId, signal),
    enabled: active,
    staleTime: 60000,
    retry: 1,
  });
  const mappings = useQuery({
    queryKey: queryKeys.distribution.runtime('mappings', connection.bindingId),
    queryFn: ({ signal }) => api.mappings(connection.bindingId, signal),
    enabled: active,
    retry: 1,
  });
  const state = connectionStates[connection.state] ?? { label: 'Недоступно', tone: 'red' };
  const usedBy = rules
    .filter((rule) => rule.bindingId === connection.bindingId)
    .map((rule) => groups.find((group) => group.id === rule.groupId)?.name)
    .filter((name): name is string => Boolean(name));
  const verified = mappings.data?.filter((m) => m.state === 'verified').length ?? 0;
  const ackPending = connection.mappingRevision !== connection.mappingAckRevision;
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
      <Card
        title={`Аккаунт amoCRM ${connection.accountId}`}
        extra={<Pill tone={state.tone}>{state.label}</Pill>}
        bodyClassName="space-y-4"
      >
        {connection.state === 'revoked' && (
          <Problem>Подключение недоступно: распределение по этому аккаунту не работает.</Problem>
        )}
        {connection.state === 'pending' && (
          <Problem>
            Подключение ещё не подтверждено. Распределение начнётся после подтверждения.
          </Problem>
        )}
        {active && ackPending && (
          <Problem>
            Сопоставления сотрудников ждут подтверждения amoCRM. До подтверждения доступ к сделкам
            закрыт.
          </Problem>
        )}
        <DefinitionList
          items={[
            ['Установка', <span className="break-all">{connection.installationId || '—'}</span>],
            [
              'Сотрудники',
              !active
                ? '—'
                : mappings.data
                  ? `${verified} из ${mappings.data.length} связаны с пользователями amoCRM`
                  : mappings.isError
                    ? 'Связи не получены'
                    : 'Проверяем связи…',
            ],
            [
              'Справочник',
              !active
                ? '—'
                : refs.data
                  ? `${refs.data.pipelines.length} ${plural(refs.data.pipelines.length, 'воронка', 'воронки', 'воронок')}, ${refs.data.users.filter((u) => u.isActive).length} активных пользователей`
                  : refs.isError
                    ? 'Недоступен'
                    : 'Загружаем…',
            ],
            ...(refs.data?.fetchedAt
              ? ([['Проверено', dateText(refs.data.fetchedAt, timezone)]] as [string, string][])
              : []),
            ['Группы', usedBy.length ? usedBy.join(', ') : 'Не используется в группах'],
          ]}
        />
        {refs.isError && <Failure error={refs.error} retry={() => void refs.refetch()} />}
      </Card>
      <Card
        title="Сопоставление сотрудников"
        description="Связь сотрудника TeamOS с пользователем amoCRM. Без подтверждённой связи сотрудник не получает сделки."
        bodyClassName="px-0 pt-3 pb-1"
      >
        {!active ? (
          <p className="px-5 pb-4 text-sm text-slate-500">
            Связи появятся после подтверждения подключения.
          </p>
        ) : mappings.isError ? (
          <div className="px-5 pb-4">
            <Failure error={mappings.error} retry={() => void mappings.refetch()} />
          </div>
        ) : mappings.isPending ? (
          <p role="status" className="px-5 pb-4 text-sm text-slate-500">
            Загружаем связи…
          </p>
        ) : mappings.data.length === 0 ? (
          <p className="px-5 pb-4 text-sm text-slate-500">Связей с amoCRM пока нет.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left">
              <thead>
                <tr>
                  {['Сотрудник', 'Пользователь amoCRM', 'Состояние', 'Проверено'].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="border-y border-slate-200 bg-surface-muted px-3.5 py-3 text-xs font-semibold whitespace-nowrap text-slate-500 first:pl-5 last:pr-5"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mappings.data.map((mapping) => {
                  const user = users.find(
                    (u) => u.id === (mapping.userId ?? mapping.userIdSnapshot),
                  );
                  const crmUser = refs.data?.users.find((u) => u.id === mapping.crmUserId);
                  const mappingState = mappingStates[mapping.state] ?? {
                    label: 'Состояние уточняется',
                    tone: 'neutral' as const,
                  };
                  const name = user ? fullName(user) : 'Удалённый сотрудник';
                  return (
                    <tr key={mapping.id ?? mapping.userIdSnapshot}>
                      <td className="border-b border-slate-100 py-3 pr-3.5 pl-5 text-sm">
                        <span className="flex items-center gap-2.5">
                          <PersonAvatar name={name} seed={mapping.userIdSnapshot} size="xs" />
                          <span className="font-medium whitespace-nowrap text-ink">{name}</span>
                        </span>
                      </td>
                      <td className="border-b border-slate-100 px-3.5 py-3 text-sm text-slate-700 dark:text-slate-200">
                        {crmUser ? (
                          <span className={cn(!crmUser.isActive && 'text-slate-500')}>
                            {crmUser.name}
                            {!crmUser.isActive && ' · неактивен'}
                          </span>
                        ) : (
                          `ID ${mapping.crmUserId}`
                        )}
                      </td>
                      <td className="border-b border-slate-100 px-3.5 py-3">
                        <Pill tone={mappingState.tone}>{mappingState.label}</Pill>
                      </td>
                      <td className="border-b border-slate-100 py-3 pr-5 pl-3.5 text-sm whitespace-nowrap text-slate-500">
                        {dateText(mapping.verifiedAt, timezone)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string) {
  const mod100 = Math.abs(n) % 100;
  const mod10 = mod100 % 10;
  if (mod100 > 10 && mod100 < 20) return many;
  if (mod10 === 1) return one;
  if (mod10 > 1 && mod10 < 5) return few;
  return many;
}
