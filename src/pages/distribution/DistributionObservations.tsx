import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { distributionRuntimeApi as api, type Rule } from '@/api/distributionRuntime';
import { queryKeys } from '@/api/queryKeys';
import { Badge, Button } from '@/components/ui';
import type { User } from '@/types';
import { fullName } from '@/lib/labels';
import { Failure, panelClass, useVisiblePolling, dateText, reasonText } from './runtimeShared';

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
  return (
    <section
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-slate-200 bg-surface px-4 py-3"
      aria-label="Режим распределения"
    >
      <Badge
        variant={
          !enabled
            ? 'warning'
            : rule.executionMode === 'observe'
              ? 'neutral'
              : supported
                ? 'success'
                : 'warning'
        }
      >
        {!supported
          ? 'Режим не подтверждён источником'
          : !enabled
            ? 'Распределение приостановлено'
            : rule.executionMode === 'observe'
              ? 'Наблюдение — без назначений'
              : 'Распределение включено'}
      </Badge>
      <p className="text-xs text-slate-500">
        {!supported
          ? 'Источник не подтвердил режим. Проверьте совместимость сервисов перед запуском.'
          : rule.executionMode === 'observe'
            ? 'Сохраняем предложения, без назначения в amoCRM.'
            : !enabled
              ? 'Новые назначения приостановлены. Проверьте настройки перед возобновлением.'
              : 'Назначаем доступным сотрудникам по очереди.'}
      </p>
      <details className="text-xs text-slate-500">
        <summary className="cursor-pointer">Детали режима</summary>
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
export function DistributionObservations({
  rule,
  users,
  timezone,
}: {
  rule: Rule;
  users: User[];
  timezone?: string;
}) {
  const [params, setParams] = useSearchParams();
  const raw = params.get('observationsOffset');
  const offset = raw === null ? 0 : Number(raw);
  const valid = Number.isSafeInteger(offset) && offset >= 0 && offset <= 100000;
  const polling = useVisiblePolling();
  const refs = useQuery({
    queryKey: queryKeys.distribution.runtime('references', rule.bindingId),
    queryFn: ({ signal }) => api.references(rule.bindingId, signal),
    enabled: !!rule.bindingId,
    ...polling,
  });
  const observations = useQuery({
    queryKey: queryKeys.distribution.runtime('observations', rule.id, offset),
    queryFn: ({ signal }) => api.observations(rule.id, offset, signal),
    enabled: valid && rule.executionMode !== undefined,
    ...polling,
  });
  const move = (next: number) => {
    const changed = new URLSearchParams(params);
    if (next) changed.set('observationsOffset', String(next));
    else changed.delete('observationsOffset');
    setParams(changed);
  };
  return (
    <section className={panelClass} aria-label="Журнал наблюдений">
      <h2 className="text-lg font-semibold">Журнал наблюдений</h2>
      <p className="mt-2 text-sm text-slate-500">
        Каждая запись — предварительное решение на указанное время. Оно не подтверждает назначение.
        Ответственный в amoCRM и предлагаемый сотрудник — разные факты.
      </p>
      {refs.error && (
        <p className="mt-3 text-sm text-warning-700">
          Имена пользователей amoCRM не удалось проверить. Записи наблюдения доступны независимо от
          справочника.
        </p>
      )}
      {rule.executionMode === undefined ? (
        <p className="mt-4 text-sm">
          Источник не подтвердил поддержку журнала наблюдений. Нужны совместимые версии сервисов.
        </p>
      ) : !valid ? (
        <p role="alert">
          Некорректная страница наблюдений.{' '}
          <button type="button" onClick={() => move(0)}>
            К первой странице
          </button>
        </p>
      ) : observations.error ? (
        <Failure error={observations.error} retry={() => void observations.refetch()} />
      ) : observations.isPending ? (
        <p role="status">Загружаем наблюдения…</p>
      ) : observations.data ? (
        <>
          {observations.data.items.length === 0 ? (
            <p className="mt-4 text-sm">В доступной области записей наблюдения пока нет.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {observations.data.items.map((item) => {
                const employee = users.find((user) => user.id === item.plannedEmployeeId);
                return (
                  <li key={item.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">Сделка {item.leadId}</p>
                      <Badge variant="neutral">
                        {item.decisionKind === 'assign'
                          ? 'Предложен получатель'
                          : item.decisionKind === 'keep'
                            ? 'Предлагается оставить'
                            : item.decisionKind === 'wait'
                              ? 'Предлагается ожидание'
                              : item.decisionKind === 'requires_configuration'
                                ? 'Нужна настройка'
                                : item.decisionKind === 'skipped'
                                  ? 'Наблюдение пропущено'
                                  : 'Тип решения неизвестен'}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm">
                      {item.decisionKind === 'keep'
                        ? 'Текущий ответственный подходит по правилу и графику; предлагается оставить его.'
                        : reasonText(item.reason)}
                    </p>
                    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-slate-500">Ответственный на момент наблюдения</dt>
                        <dd>
                          {item.currentResponsibleUserId
                            ? (!refs.error ? refs.data?.users : undefined)?.find(
                                (user) => user.id === item.currentResponsibleUserId,
                              )?.name || 'Имя ответственного недоступно'
                            : 'Неизвестно'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Предлагаемый сотрудник</dt>
                        <dd>
                          {employee
                            ? fullName(employee)
                            : item.plannedEmployeeId
                              ? 'Имя недоступно'
                              : 'Не выбран'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Время наблюдения</dt>
                        <dd>{dateText(item.checkedAt, timezone)}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Следующая смена</dt>
                        <dd>{dateText(item.nextShiftAt, timezone)}</dd>
                      </div>
                    </dl>
                    <details className="mt-3 break-all text-xs text-slate-500">
                      <summary>Версии и идентификаторы</summary>
                      <p>
                        ID {item.id}; период {item.executionEpoch}; правило {item.ruleRevision};
                        графики {item.availabilityRevision}; наблюдение {item.observationRevision}
                      </p>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {offset > 0 && (
              <Button size="sm" variant="secondary" onClick={() => move(Math.max(0, offset - 25))}>
                Предыдущие наблюдения
              </Button>
            )}
            {(observations.data.hasMore ?? observations.data.items.length === 25) && (
              <Button size="sm" variant="secondary" onClick={() => move(offset + 25)}>
                Следующие наблюдения
              </Button>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
