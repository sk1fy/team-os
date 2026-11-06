import { useQuery } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { queryKeys } from '@/api/queryKeys';
import {
  distributionRuntimeApi as api,
  type Availability,
  type Group,
  type Rule,
} from '@/api/distributionRuntime';
import type { User } from '@/types';
import { fullName } from '@/lib/labels';
import { dateText, Failure, reasonText } from './runtimeShared';
import { funnelText, groupStatus, sourceLabels } from './groupPresentation';
import { Card, DefinitionList, PersonAvatar, Pill } from './ui';

/** Сводка правила группы (`dl` из инспектора группы в концепте). */
export function GroupSummary({ group, rule }: { group: Group; rule: Rule }) {
  const refs = useQuery({
    queryKey: queryKeys.distribution.runtime('references', rule.bindingId),
    queryFn: ({ signal }) => api.references(rule.bindingId, signal),
    enabled: !!rule.bindingId,
    retry: 1,
  });
  const status = groupStatus(group, rule);
  const participating = group.memberIds.filter(
    (id) => !(group.disabledMemberIds ?? []).includes(id),
  ).length;
  return (
    <Card title="Правило группы" extra={<Pill tone={status.tone}>{status.label}</Pill>}>
      <DefinitionList
        items={[
          ['Воронка', funnelText(rule, refs.data?.pipelines)],
          ['Запуск', sourceLabels[rule.source] ?? 'Тип запуска не подтверждён'],
          ['Порядок', 'По очереди между сотрудниками, доступными по графику'],
          [
            'Ответственный',
            rule.keepCurrentResponsible
              ? 'Оставлять сделку у текущего, если он доступен'
              : 'Текущий ответственный не учитывается',
          ],
          ['Участники', `${group.memberIds.length} в группе · участвуют ${participating}`],
        ]}
      />
      {refs.isError && (
        <p className="mt-3 text-xs text-warning-700">
          Названия воронки и этапа не получены: справочник amoCRM недоступен.
        </p>
      )}
    </Card>
  );
}

/** Доступность сотрудников по графику (список «Доступность сегодня» в концепте). */
export function GroupAvailability({
  availability,
  users,
  timezone,
}: {
  availability: {
    data?: Availability;
    error: unknown;
    isError: boolean;
    isPending: boolean;
    refetch: () => unknown;
  };
  users: User[];
  timezone?: string;
}) {
  return (
    <Card
      title="Доступность по графику"
      description="Рабочая нагрузка не рассчитывается: источник этой метрики пока не подключён."
    >
      {availability.isError ? (
        <Failure error={availability.error} retry={() => void availability.refetch()} />
      ) : availability.isPending ? (
        <p role="status" className="text-sm text-slate-500">
          Проверяем расписания…
        </p>
      ) : availability.data?.employees.length ? (
        <ul>
          {availability.data.employees.map((e) => {
            const user = users.find((u) => u.id === e.employeeId);
            const name = user ? fullName(user) : `Сотрудник ${e.employeeId}`;
            return (
              <li
                key={e.employeeId}
                className="flex items-center gap-3 border-b border-slate-100 py-2.5 first:pt-0 last:border-b-0 last:pb-0"
              >
                <PersonAvatar name={name} seed={e.employeeId} size="xs" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium break-words text-ink">{name}</p>
                  <p className="text-xs text-slate-500">
                    {e.available
                      ? `Доступен до ${dateText(e.until, timezone)}`
                      : `Следующая смена: ${dateText(e.nextShift, timezone)}`}
                  </p>
                </div>
                <Pill tone={e.available ? 'green' : e.reason === 'unmapped' ? 'amber' : 'neutral'}>
                  {e.available ? 'Доступен' : reasonText(e.reason)}
                </Pill>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">В группе пока нет сотрудников.</p>
      )}
      <p className="mt-4 flex items-start gap-2 rounded-[10px] bg-slate-100 px-3.5 py-3 text-[13px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Доступность берётся из графика работы: сотрудник вне смены не получает сделки.
      </p>
    </Card>
  );
}
