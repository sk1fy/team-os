import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Check,
  CircleHelp,
  Clock,
  Settings2,
  SkipForward,
  UserCheck,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { distributionRuntimeApi as api, type Rule } from '@/api/distributionRuntime';
import { queryKeys } from '@/api/queryKeys';
import { Button, Checkbox } from '@/components/ui';
import type { User } from '@/types';
import { fullName } from '@/lib/labels';
import { ObservationAssignmentControl } from './ObservationAssignmentControl';
import { Failure, useVisiblePolling, dateText, reasonText } from './runtimeShared';
import { cardClass, iconBoxClass, Pill, Problem, type PillTone } from './ui';

export function ExecutionModeNotice({
  rule,
  groupActive = true,
  timezone,
}: {
  rule: Rule;
  groupActive?: boolean;
  timezone?: string;
}) {
  const enabled = groupActive && rule.active;
  const supported = rule.executionMode === 'live' || rule.executionMode === 'observe';
  const tone: PillTone =
    !supported || !enabled ? 'amber' : rule.executionMode === 'observe' ? 'blue' : 'green';
  return (
    <section
      className={`${cardClass} flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3`}
      aria-label="Режим распределения"
    >
      <Pill tone={tone}>
        {!supported
          ? 'Режим не подтверждён источником'
          : !enabled
            ? 'Распределение приостановлено'
            : rule.executionMode === 'observe'
              ? 'Наблюдение — без назначений'
              : 'Распределение включено'}
      </Pill>
      <p className="min-w-0 flex-1 basis-56 text-[13px] text-slate-600 dark:text-slate-300">
        {!supported
          ? 'Источник не подтвердил режим. Проверьте совместимость сервисов перед запуском.'
          : rule.executionMode === 'observe'
            ? 'Сохраняем предложения, без назначения в amoCRM.'
            : !enabled
              ? 'Новые назначения приостановлены. Проверьте настройки перед возобновлением.'
              : 'Назначаем доступным сотрудникам по очереди.'}
      </p>
      <details className="text-xs text-slate-500">
        <summary className="cursor-pointer font-medium">Детали режима</summary>
        <p className="mt-2">
          {rule.executionMode === 'live'
            ? 'Рабочий режим'
            : rule.executionMode === 'observe'
              ? 'Наблюдение'
              : 'Нужна совместимая версия сервера'}{' '}
          · Период: {rule.executionEpoch ?? '—'} · начало рабочего периода:{' '}
          {dateText(rule.liveStartedAt, timezone)}
        </p>
        <p className="mt-1">
          Результат назначения показывается после подтверждения. Исторические наблюдения не
          включаются автоматически.
        </p>
      </details>
    </section>
  );
}

const decisions: Record<string, { label: string; tone: PillTone; icon: LucideIcon }> = {
  assign: { label: 'Предложен получатель', tone: 'brand', icon: UserCheck },
  keep: { label: 'Предлагается оставить', tone: 'neutral', icon: UserRound },
  wait: { label: 'Предлагается ожидание', tone: 'amber', icon: Clock },
  requires_configuration: { label: 'Нужна настройка', tone: 'amber', icon: Settings2 },
  skipped: { label: 'Наблюдение пропущено', tone: 'neutral', icon: SkipForward },
};
const unknownDecision = {
  label: 'Тип решения неизвестен',
  tone: 'neutral' as const,
  icon: CircleHelp,
};

export function DistributionObservations({
  rule,
  users,
  timezone,
  canAssign,
}: {
  rule: Rule;
  users: User[];
  timezone?: string;
  canAssign: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const raw = params.get('observationsOffset');
  const offset = raw === null ? 0 : Number(raw);
  const showCompleted = params.get('showCompleted') === '1';
  const valid = Number.isSafeInteger(offset) && offset >= 0 && offset <= 100000;
  const polling = useVisiblePolling();
  const refs = useQuery({
    queryKey: queryKeys.distribution.runtime('references', rule.bindingId),
    queryFn: ({ signal }) => api.references(rule.bindingId, signal),
    enabled: !!rule.bindingId,
    ...polling,
  });
  const observations = useQuery({
    queryKey: queryKeys.distribution.runtime('observations', rule.id, showCompleted, offset),
    queryFn: ({ signal }) =>
      api.observations({ ruleId: rule.id, offset, hideCompleted: !showCompleted }, signal),
    enabled: valid && rule.executionMode !== undefined,
    ...polling,
  });
  const move = (next: number) => {
    const changed = new URLSearchParams(params);
    if (next) changed.set('observationsOffset', String(next));
    else changed.delete('observationsOffset');
    setParams(changed);
  };
  const changeCompleted = (checked: boolean) => {
    const changed = new URLSearchParams(params);
    if (checked) changed.set('showCompleted', '1');
    else changed.delete('showCompleted');
    changed.delete('observationsOffset');
    setParams(changed);
  };
  return (
    <section className={cardClass} aria-label="Журнал наблюдений">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-[18px]">
        <div className="min-w-0 flex-1 basis-72">
          <h2 className="text-[15px] font-semibold text-ink">Журнал наблюдений</h2>
          <p className="mt-1 max-w-[720px] text-[13px] text-slate-500">
            Каждая запись — предварительное решение на указанное время. Оно не подтверждает
            назначение. Ответственный в amoCRM и предлагаемый сотрудник — разные факты.
          </p>
        </div>
        {rule.executionMode !== undefined && (
          <Checkbox
            className="text-sm"
            label="Показать завершённые"
            checked={showCompleted}
            onCheckedChange={changeCompleted}
          />
        )}
      </div>
      <div className="space-y-3 px-5 py-[18px]">
        {refs.error && (
          <Problem role={false}>
            Имена пользователей amoCRM не удалось проверить. Записи наблюдения доступны независимо
            от справочника.
          </Problem>
        )}
        {rule.executionMode === undefined ? (
          <p className="text-sm text-ink">
            Источник не подтвердил поддержку журнала наблюдений. Нужны совместимые версии сервисов.
          </p>
        ) : !valid ? (
          <Problem
            role="alert"
            action={
              <Button size="sm" variant="secondary" onClick={() => move(0)}>
                К первой странице
              </Button>
            }
          >
            Некорректная страница наблюдений.
          </Problem>
        ) : observations.error ? (
          <Failure error={observations.error} retry={() => void observations.refetch()} />
        ) : observations.isPending ? (
          <p role="status" className="py-6 text-center text-sm text-slate-500">
            Загружаем наблюдения…
          </p>
        ) : observations.data ? (
          <>
            {observations.data.items.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                {offset > 0
                  ? 'На этой странице нет доступных записей наблюдения.'
                  : 'В доступной области записей наблюдения пока нет.'}
              </p>
            ) : (
              <ul>
                {observations.data.items.map((item) => {
                  const employee = users.find((user) => user.id === item.plannedEmployeeId);
                  const decision = decisions[item.decisionKind] ?? unknownDecision;
                  const Icon = item.completed ? Check : decision.icon;
                  return (
                    <li
                      key={item.id}
                      className="flex items-start gap-3 border-b border-slate-100 py-4 first:pt-1 last:border-b-0 last:pb-1"
                    >
                      <span
                        aria-hidden="true"
                        className={iconBoxClass(
                          item.completed
                            ? 'green'
                            : decision.tone === 'amber'
                              ? 'amber'
                              : decision.tone === 'brand'
                                ? 'brand'
                                : 'neutral',
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-ink">Сделка {item.leadId}</p>
                          {item.completed && <Pill tone="green">Назначение подтверждено</Pill>}
                          <Pill tone={decision.tone}>{decision.label}</Pill>
                          <span className="text-xs text-slate-500 sm:ml-auto">
                            <span className="sr-only">Время наблюдения: </span>
                            {dateText(item.checkedAt, timezone)}
                          </span>
                        </div>
                        <p className="mt-1 text-[13.5px] text-slate-600 dark:text-slate-300">
                          {item.decisionKind === 'keep'
                            ? 'Текущий ответственный подходит по правилу и графику; предлагается оставить его.'
                            : reasonText(item.reason)}
                        </p>
                        <dl className="mt-2.5 grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-3">
                          <div className="min-w-0">
                            <dt className="text-xs text-slate-500">
                              Ответственный на момент наблюдения
                            </dt>
                            <dd className="mt-0.5 break-words text-ink">
                              {item.currentResponsibleUserId
                                ? (!refs.error ? refs.data?.users : undefined)?.find(
                                    (user) => user.id === item.currentResponsibleUserId,
                                  )?.name || 'Имя ответственного недоступно'
                                : 'Неизвестно'}
                            </dd>
                          </div>
                          <div className="min-w-0">
                            <dt className="text-xs text-slate-500">Предлагаемый сотрудник</dt>
                            <dd className="mt-0.5 break-words text-ink">
                              {employee
                                ? fullName(employee)
                                : item.plannedEmployeeId
                                  ? 'Имя недоступно'
                                  : 'Не выбран'}
                            </dd>
                          </div>
                          <div className="min-w-0">
                            <dt className="text-xs text-slate-500">Следующая смена</dt>
                            <dd className="mt-0.5 text-ink">
                              {dateText(item.nextShiftAt, timezone)}
                            </dd>
                          </div>
                        </dl>
                        {canAssign && !item.completed && (
                          <ObservationAssignmentControl
                            ruleId={rule.id}
                            observation={item}
                            users={users}
                            crmUsers={refs.error ? undefined : refs.data?.users}
                          />
                        )}
                        <details className="mt-2.5 text-xs break-all text-slate-500">
                          <summary className="cursor-pointer">Версии и идентификаторы</summary>
                          <p className="mt-1">
                            ID {item.id}; период {item.executionEpoch}; правило {item.ruleRevision};
                            графики {item.availabilityRevision}; наблюдение{' '}
                            {item.observationRevision}
                          </p>
                        </details>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {(offset > 0 ||
              (observations.data.hasMore ?? observations.data.items.length === 25)) && (
              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                {offset > 0 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => move(Math.max(0, offset - 25))}
                  >
                    Предыдущие наблюдения
                  </Button>
                )}
                {(observations.data.hasMore ?? observations.data.items.length === 25) && (
                  <Button size="sm" variant="secondary" onClick={() => move(offset + 25)}>
                    Следующие наблюдения
                  </Button>
                )}
              </div>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
}
