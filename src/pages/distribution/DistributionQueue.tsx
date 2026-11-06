import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { httpOrgApi as orgApi } from '@/api/http';
import { queryKeys } from '@/api/queryKeys';
import { distributionRuntimeApi as api, type Group } from '@/api/distributionRuntime';
import { Button, Select } from '@/components/ui';
import { useSectionTabCount } from '@/components/layout/tabCounts';
import { cn } from '@/lib/cn';
import { fullName } from '@/lib/labels';
import { dateText, Failure, reasonText, StateBadge, useVisiblePolling } from './runtimeShared';
import {
  accountDateTime,
  isQueueFinished,
  isQueueConfirmed,
  queueDuration,
} from './queuePresentation';
import { QueueDetails, QueueWaitingInfo } from './QueueDetails';
import { cardClass, Kpi, PersonAvatar, segButtonClass, segClass } from './ui';

const pageSize = 15;
/** Значения уходят в API как параметр `tab` очереди — не менять. */
const tabs = [
  ['waiting', 'Ожидают'],
  ['completed', 'Завершены'],
  ['errors', 'Ошибки'],
  ['cancelled', 'Отменены'],
] as const;

/** Колонки таблицы очереди: Сделка, (Группа), Событие, Причина, Состояние. */
const columns = (withGroup: boolean) =>
  withGroup
    ? 'lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,2fr)_9.5rem]'
    : 'lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,2.2fr)_9.5rem]';

export function DistributionQueue({ groups, groupId }: { groups: Group[]; groupId?: string }) {
  const [tab, setTab] = useState('waiting');
  const [selectedGroup, setGroup] = useState(groupId ?? '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const restoreRef = useRef<HTMLButtonElement | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const poll = useVisiblePolling();
  const summary = useQuery({
    queryKey: queryKeys.distribution.runtime('summary', selectedGroup || undefined),
    queryFn: ({ signal }) => api.summary(selectedGroup || undefined, signal),
    ...poll,
  });
  let filterError = '';
  let fromUTC: string | undefined;
  let toUTC: string | undefined;
  try {
    if ((from || to) && !summary.data?.timezone)
      throw new Error('Для фильтра по времени нужен подтверждённый часовой пояс аккаунта.');
    if (from) fromUTC = accountDateTime(from, summary.data!.timezone!);
    if (to) toUTC = accountDateTime(to, summary.data!.timezone!);
    if (fromUTC && toUTC && fromUTC > toUTC)
      throw new Error('Начало периода должно быть раньше его окончания.');
  } catch (error) {
    filterError = error instanceof Error ? error.message : 'Проверьте период.';
  }
  const filter = { tab, groupId: selectedGroup || undefined, from: fromUTC, to: toUTC, offset };
  const queue = useQuery({
    queryKey: queryKeys.distribution.runtime('queue', filter),
    queryFn: ({ signal }) => api.queue(filter, signal),
    enabled: !filterError,
    ...poll,
  });
  useEffect(() => {
    if (
      queue.isSuccess &&
      !queue.isFetching &&
      queue.data.items.length === 0 &&
      offset > 0 &&
      !filterError
    )
      setOffset((current) => Math.max(0, current - pageSize));
  }, [queue.isSuccess, queue.isFetching, queue.data, offset, filterError]);
  const users = useQuery({
    queryKey: queryKeys.distribution.runtime('users'),
    queryFn: orgApi.getUsers,
  });
  const employee = (id: string | null) => {
    const user = users.data?.find((u) => u.id === id);
    return user ? fullName(user) : id ? 'Сотрудник' : 'Не выбран';
  };
  const change = () => {
    setOffset(0);
    void summary.refetch();
  };
  const timezone = summary.data?.timezone;
  const metrics = summary.data?.metricsAvailable === true;
  const metric = (value: number | null | undefined) => (metrics ? (value ?? '—') : '—');
  const counts: Partial<Record<(typeof tabs)[number][0], number | null | undefined>> = metrics
    ? { waiting: summary.data?.waiting, errors: summary.data?.errors }
    : {};
  const attention = metrics ? (summary.data?.errors ?? 0) : 0;
  const withGroup = !groupId;
  // Число на вкладке «Очередь» — только для общей очереди без фильтра по группе.
  useSectionTabCount(
    'queue',
    withGroup && !selectedGroup ? (counts.waiting ?? undefined) : undefined,
  );
  const panelId = `distribution-panel-${groupId ?? 'all'}`;
  return (
    <div className="space-y-4">
      {summary.isError ? (
        <Failure error={summary.error} retry={() => void summary.refetch()} />
      ) : (
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Kpi
            label="Ожидают"
            value={metric(summary.data?.waiting)}
            hint={
              metrics && summary.data?.assigning
                ? `из них назначаются — ${summary.data.assigning}`
                : 'в очереди сейчас'
            }
          />
          <Kpi
            label="Распределены сегодня"
            value={metric(summary.data?.confirmedToday)}
            hint="только подтверждённые"
          />
          <Kpi
            label="Требуют внимания"
            value={metric(summary.data?.errors)}
            hint="ошибки назначения"
            tone={attention > 0 ? 'warn' : undefined}
          />
        </dl>
      )}
      <section className={cardClass} aria-label="Очередь сделок">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3.5">
          <div className={segClass} role="tablist" aria-label="Состояние сделок">
            {tabs.map(([value, label]) => {
              const count = counts[value];
              return (
                <button
                  key={value}
                  type="button"
                  ref={(node) => {
                    tabRefs.current[value] = node;
                  }}
                  role="tab"
                  id={`distribution-tab-${groupId ?? 'all'}-${value}`}
                  aria-controls={panelId}
                  tabIndex={tab === value ? 0 : -1}
                  aria-selected={tab === value}
                  className={segButtonClass(tab === value)}
                  onKeyDown={(event) => {
                    const direction =
                      event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
                    if (direction) {
                      event.preventDefault();
                      const index = tabs.findIndex((t) => t[0] === value);
                      const next = tabs[(index + direction + tabs.length) % tabs.length][0];
                      setTab(next);
                      setOffset(0);
                      tabRefs.current[next]?.focus();
                    }
                  }}
                  onClick={() => {
                    setTab(value);
                    change();
                  }}
                >
                  {label}
                  {count != null && (
                    <span aria-hidden="true" className="text-[11px] font-normal text-slate-600">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
            {withGroup && (
              <Select
                label="Группа"
                className="min-w-0 flex-1 basis-full sm:basis-48 lg:w-52 lg:flex-none [&>span:first-child]:sr-only"
                value={selectedGroup || 'all'}
                onValueChange={(value) => {
                  setGroup(value === 'all' ? '' : value);
                  change();
                }}
                options={[
                  { value: 'all', label: 'Все группы' },
                  ...groups.map((g) => ({ value: g.id, label: g.name })),
                ]}
              />
            )}
            <PeriodField
              prefix="с"
              label="С события"
              value={from}
              onChange={(value) => {
                setFrom(value);
                change();
              }}
            />
            <PeriodField
              prefix="по"
              label="До события"
              value={to}
              min={from || undefined}
              onChange={(value) => {
                setTo(value);
                change();
              }}
            />
          </div>
        </div>
        {filterError && (
          <p role="alert" className="border-b border-slate-100 px-4 py-3 text-sm text-danger-700">
            {filterError}
          </p>
        )}
        {!filterError && queue.isPending && (
          <p role="status" className="px-4 py-10 text-center text-sm text-slate-500">
            Загружаем очередь…
          </p>
        )}
        {queue.isError && (
          <div className="p-4">
            <Failure error={queue.error} retry={() => void queue.refetch()} />
          </div>
        )}
        {!filterError && queue.data?.items.length === 0 && !queue.isError && (
          <p role="status" className="px-5 py-11 text-center text-sm text-slate-500">
            В этой части очереди пока нет сделок.
          </p>
        )}
        {!filterError && !queue.isError && (
          <div
            role="tabpanel"
            id={panelId}
            aria-labelledby={`distribution-tab-${groupId ?? 'all'}-${tab}`}
          >
            {!!queue.data?.items.length && (
              <div
                aria-hidden="true"
                className={cn(
                  'hidden gap-x-4 border-b border-slate-200 bg-surface-muted px-4 py-3 text-xs font-semibold text-slate-500 lg:grid',
                  columns(withGroup),
                )}
              >
                <span>Сделка</span>
                {withGroup && <span>Группа</span>}
                <span>Событие</span>
                <span>{tab === 'completed' ? 'Итог' : 'Причина'}</span>
                <span className="text-right">Состояние</span>
              </div>
            )}
            {queue.data?.items.map((item) => {
              const finished = isQueueFinished(item.state);
              const failed = ['failed', 'error'].includes(item.state);
              const groupName =
                groups.find((g) => g.id === item.groupId)?.name ?? 'Группа распределения';
              return (
                <article
                  key={item.id}
                  className={cn(
                    'grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 border-b border-slate-100 px-4 py-3 last:border-b-0 lg:items-start',
                    columns(withGroup),
                  )}
                  aria-label={item.leadId ? `Сделка №${item.leadId}` : 'Сделка'}
                >
                  <div className="col-start-1 row-start-1 min-w-0 lg:col-auto lg:row-auto">
                    <button
                      type="button"
                      onClick={(event) => {
                        restoreRef.current = event.currentTarget;
                        setSelected(item.id);
                      }}
                      className="text-left text-sm font-semibold break-words text-ink hover:text-primary-700 hover:underline"
                    >
                      {item.leadId
                        ? item.leadName
                          ? `${item.leadName} · №${item.leadId}`
                          : `Сделка №${item.leadId}`
                        : 'Сделка · подробности недоступны'}
                    </button>
                    {item.leadUrl && /^https:\/\//.test(item.leadUrl) && (
                      <div className="mt-0.5">
                        <a
                          href={item.leadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary-700 hover:underline"
                          aria-label={`Открыть сделку ${item.leadId} в amoCRM`}
                        >
                          amoCRM ↗
                        </a>
                      </div>
                    )}
                  </div>
                  {withGroup && (
                    <div className="col-span-2 min-w-0 text-sm break-words lg:col-span-1">
                      <span className="sr-only">Группа: </span>
                      <Link
                        to={`/distribution/${item.groupId}`}
                        className="text-slate-700 hover:text-primary-700 hover:underline dark:text-slate-200"
                      >
                        {groupName}
                      </Link>
                    </div>
                  )}
                  <div className="col-span-2 min-w-0 text-sm lg:col-span-1">
                    <span className="text-slate-700 dark:text-slate-200">
                      <span className="lg:sr-only">Поступила: </span>
                      {dateText(item.createdAt, timezone)}
                    </span>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {finished ? 'Длительность' : 'В очереди'}:{' '}
                      {queueDuration(item.createdAt, finished ? item.updatedAt : Date.now())}
                    </div>
                  </div>
                  <div className="col-span-2 min-w-0 lg:col-span-1">
                    <p
                      className={cn(
                        'text-[13.5px] break-words',
                        failed ? 'text-danger-700 dark:text-red-300' : 'text-ink',
                      )}
                    >
                      {reasonText(item.reason)}
                    </p>
                    {(finished || isQueueConfirmed(item.state)) && (
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        {finished && (
                          <span>
                            {item.state === 'cancelled' ? 'Отменена' : 'Итог'}:{' '}
                            {dateText(item.updatedAt, timezone)}
                          </span>
                        )}
                        {isQueueConfirmed(item.state) && (
                          <span className="inline-flex min-w-0 items-center gap-1.5">
                            Ответственный:
                            <PersonAvatar
                              name={employee(item.plannedEmployeeId)}
                              seed={item.plannedEmployeeId ?? undefined}
                              size="xs"
                              className="size-5 text-[9px]"
                            />
                            <span className="font-medium break-words text-slate-700 dark:text-slate-200">
                              {employee(item.plannedEmployeeId)}
                            </span>
                          </span>
                        )}
                      </div>
                    )}
                    {!finished && <QueueWaitingInfo item={item} timezone={timezone} />}
                  </div>
                  <div className="col-start-2 row-start-1 lg:col-auto lg:row-auto lg:text-right">
                    <span className="sr-only">Состояние: </span>
                    <StateBadge state={item.state} />
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
          <div className="min-w-0 flex-1 basis-64 text-xs text-slate-500">
            <p>
              Сегодня — {timezone ?? 'часовой пояс не настроен'}. Последнее обновление:{' '}
              {queue.dataUpdatedAt
                ? dateText(new Date(queue.dataUpdatedAt).toISOString(), timezone)
                : '—'}
              {queue.isError ? ' · данные недоступны' : ''}
            </p>
            {!summary.isError && (
              <p className="mt-0.5">
                Статистика проверена: {dateText(summary.data?.checkedAt, timezone)}.{' '}
                {summary.data?.metricsAvailable === false
                  ? summary.data.metricsReason === 'permission_budget_exceeded'
                    ? 'Статистика временно недоступна: проверка доступа не завершилась вовремя.'
                    : 'Статистика недоступна: права или источник не подтверждены.'
                  : 'Только подтверждённые назначения.'}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500" aria-live="polite">
              Страница {Math.floor(offset / pageSize) + 1}
              {queue.data?.items.length
                ? ` · ${offset + 1}–${offset + queue.data.items.length}`
                : ''}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={!!filterError || offset === 0 || queue.isFetching}
              onClick={() => setOffset(Math.max(0, offset - pageSize))}
            >
              Назад
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!!filterError || !queue.data?.hasMore || queue.isFetching}
              onClick={() => setOffset(offset + pageSize)}
            >
              Далее
            </Button>
          </div>
        </div>
      </section>
      <QueueDetails
        id={selected}
        onClose={() => {
          if (!restoreRef.current?.isConnected) restoreRef.current = tabRefs.current[tab];
          setSelected(null);
        }}
        restoreRef={restoreRef}
        timezone={timezone}
      />
    </div>
  );
}

/** Поле периода с короткой подписью внутри (`с` / `по`), как фильтр в тулбаре концепта. */
function PeriodField({
  prefix,
  label,
  value,
  min,
  onChange,
}: {
  prefix: string;
  label: string;
  value: string;
  min?: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex h-9.5 min-w-0 flex-1 basis-full items-center gap-2 rounded-md border border-slate-200 bg-surface pr-2 pl-3 focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-primary-600 sm:basis-52 lg:flex-none">
      <label htmlFor={id} className="shrink-0 text-xs font-medium text-slate-500">
        {prefix}
      </label>
      <input
        id={id}
        aria-label={label}
        type="datetime-local"
        value={value}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
      />
    </div>
  );
}
