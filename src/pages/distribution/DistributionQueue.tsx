import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { httpAuthApi as authApi, httpOrgApi as orgApi } from '@/api/http';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import {
  distributionRuntimeApi as api,
  type Group,
  type QueueItem,
} from '@/api/distributionRuntime';
import { Button, Modal, Input } from '@/components/ui';
import { copyText } from '@/lib/clipboard';
import { fullName } from '@/lib/labels';
import {
  dateText,
  Failure,
  panelClass,
  reasonText,
  StateBadge,
  useVisiblePolling,
} from './runtimeShared';
import {
  accountDateTime,
  isQueueFinished,
  isQueueConfirmed,
  queueDuration,
} from './queuePresentation';
const pageSize = 15;
const tabs = [
  ['waiting', 'Ожидают'],
  ['completed', 'Завершены'],
  ['errors', 'Ошибки'],
  ['cancelled', 'Отменены'],
] as const;
const actions: Record<string, string> = {
  recalculate: 'Пересчитать',
  check: 'Проверить результат',
  retry: 'Повторить после исправления',
  cancel: 'Отменить',
};
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
  return (
    <section className={`${panelClass} space-y-5`}>
      <div>
        <h2 className="text-lg font-semibold">Очередь сделок</h2>
        <p className="mt-1 text-sm text-slate-500">
          Результат считается завершённым после подтверждения сервера.
        </p>
      </div>
      {summary.isError ? (
        <Failure error={summary.error} retry={() => void summary.refetch()} />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {[
              ['Ожидают', summary.data?.waiting],
              ['Распределены сегодня', summary.data?.confirmedToday],
              ['Требуют внимания', summary.data?.errors],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md bg-surface-muted p-3">
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="mt-1 text-2xl font-semibold">
                  {summary.data?.metricsAvailable ? (value ?? '—') : '—'}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-slate-500">
            Сегодня — {summary.data?.timezone ?? 'часовой пояс не настроен'}. Статистика проверена:{' '}
            {dateText(summary.data?.checkedAt, summary.data?.timezone)}.{' '}
            {summary.data?.metricsAvailable === false
              ? 'Статистика недоступна: права или источник не подтверждены.'
              : 'Только подтверждённые назначения.'}
          </p>
        </>
      )}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Состояние сделок">
        {tabs.map(([value, label]) => (
          <Button
            key={value}
            ref={(node) => {
              tabRefs.current[value] = node;
            }}
            role="tab"
            id={`distribution-tab-${groupId ?? 'all'}-${value}`}
            aria-controls={`distribution-panel-${groupId ?? 'all'}`}
            tabIndex={tab === value ? 0 : -1}
            onKeyDown={(event) => {
              const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
              if (direction) {
                event.preventDefault();
                const index = tabs.findIndex((t) => t[0] === value);
                const next = tabs[(index + direction + tabs.length) % tabs.length][0];
                setTab(next);
                setOffset(0);
                tabRefs.current[next]?.focus();
              }
            }}
            aria-selected={tab === value}
            variant={tab === value ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => {
              setTab(value);
              change();
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {!groupId && (
          <label className="text-xs font-semibold">
            Группа
            <select
              className="mt-2 block w-full rounded-md border border-slate-200 bg-surface p-2 text-sm"
              value={selectedGroup}
              onChange={(e) => {
                setGroup(e.target.value);
                change();
              }}
            >
              <option value="">Все группы</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <Input
          label="С события"
          type="datetime-local"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            change();
          }}
        />
        <Input
          label="До события"
          type="datetime-local"
          value={to}
          min={from || undefined}
          onChange={(e) => {
            setTo(e.target.value);
            change();
          }}
        />
      </div>
      {filterError && (
        <p role="alert" className="text-sm text-danger-700">
          {filterError}
        </p>
      )}
      {!filterError && queue.isPending && <p role="status">Загружаем очередь…</p>}
      {queue.isError && <Failure error={queue.error} retry={() => void queue.refetch()} />}
      {!filterError && queue.data?.items.length === 0 && !queue.isError && (
        <p
          role="status"
          className="rounded-md bg-surface-muted p-6 text-center text-sm text-slate-500"
        >
          В этой части очереди пока нет сделок.
        </p>
      )}
      {!filterError && !queue.isError && (
        <div
          role="tabpanel"
          id={`distribution-panel-${groupId ?? 'all'}`}
          aria-labelledby={`distribution-tab-${groupId ?? 'all'}-${tab}`}
          className="space-y-3"
        >
          {queue.data?.items.map((item) => (
            <article
              key={item.id}
              className="rounded-lg border border-slate-200 p-3 sm:p-4"
              aria-label={item.leadId ? `Сделка №${item.leadId}` : 'Сделка'}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <button
                    onClick={(event) => {
                      restoreRef.current = event.currentTarget;
                      setSelected(item.id);
                    }}
                    className="break-words text-left text-sm font-semibold text-primary-700 hover:underline"
                  >
                    {item.leadId
                      ? item.leadName
                        ? `${item.leadName} · №${item.leadId}`
                        : `Сделка №${item.leadId}`
                      : 'Сделка · подробности ограничены правами'}
                  </button>
                  {item.leadUrl && /^https:\/\//.test(item.leadUrl) && (
                    <a
                      href={item.leadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary-700 hover:underline"
                      aria-label={`Открыть сделку ${item.leadId} в amoCRM`}
                    >
                      amoCRM ↗
                    </a>
                  )}
                  {!groupId && (
                    <span className="text-xs text-slate-500">
                      {groups.find((g) => g.id === item.groupId)?.name ?? 'Группа распределения'}
                    </span>
                  )}
                </div>
                <StateBadge state={item.state} />
              </div>
              <p className="mt-2 text-sm">{reasonText(item.reason)}</p>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                <span>Поступила: {dateText(item.createdAt, summary.data?.timezone)}</span>
                <span>
                  {isQueueFinished(item.state) ? 'Длительность' : 'В очереди'}:{' '}
                  {queueDuration(
                    item.createdAt,
                    isQueueFinished(item.state) ? item.updatedAt : Date.now(),
                  )}
                </span>
                {isQueueFinished(item.state) && (
                  <span>
                    {item.state === 'cancelled' ? 'Отменена' : 'Итог'}:{' '}
                    {dateText(item.updatedAt, summary.data?.timezone)}
                  </span>
                )}
                {isQueueConfirmed(item.state) && (
                  <span>Ответственный: {employee(item.plannedEmployeeId)}</span>
                )}
              </div>
              {!isQueueFinished(item.state) && (
                <QueueWaitingInfo item={item} timezone={summary.data?.timezone} />
              )}
            </article>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Последнее обновление:{' '}
          {queue.dataUpdatedAt
            ? dateText(new Date(queue.dataUpdatedAt).toISOString(), summary.data?.timezone)
            : '—'}
          {queue.isError ? ' · данные недоступны' : ''}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500" aria-live="polite">
            Страница {Math.floor(offset / pageSize) + 1}
            {queue.data?.items.length ? ` · ${offset + 1}–${offset + queue.data.items.length}` : ''}
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
      <QueueDetails
        id={selected}
        onClose={() => {
          if (!restoreRef.current?.isConnected) restoreRef.current = tabRefs.current[tab];
          setSelected(null);
        }}
        restoreRef={restoreRef}
        timezone={summary.data?.timezone}
      />
    </section>
  );
}
function QueueDetails({
  id,
  onClose,
  restoreRef,
  timezone,
}: {
  id: string | null;
  onClose: () => void;
  restoreRef: React.RefObject<HTMLButtonElement | null>;
  timezone?: string | null;
}) {
  const poll = useVisiblePolling();
  const client = useQueryClient();
  const [historyOffset, setHistoryOffset] = useState(0);
  const actor = useQuery({
    queryKey: queryKeys.distribution.runtime('actor'),
    queryFn: authApi.getCurrentUser,
  });
  type ActionBody = { action: string; expectedUpdatedAt: string; requestId: string };
  // Keep uncertain request identities for this authenticated actor across route
  // changes and temporary access-denied screens, without browser persistence.
  const pendingKey = queryKeys.distribution.runtime('pending-actions', actor.data?.id);
  const { data: pendingRequests } = useQuery({
    queryKey: pendingKey,
    queryFn: async () => new Map<string, ActionBody>(),
    initialData: new Map<string, ActionBody>(),
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const setPendingRequests = (
    update: (current: Map<string, ActionBody>) => Map<string, ActionBody>,
  ) =>
    client.setQueryData<Map<string, ActionBody>>(pendingKey, (current) =>
      update(current ?? new Map()),
    );
  const [messages, setMessages] = useState<Record<string, string>>({});
  const clearPending = (itemId: string) =>
    setPendingRequests((current) => {
      const next = new Map(current);
      next.delete(itemId);
      return next;
    });
  const message = id ? messages[id] : '';
  const setMessage = (itemId: string, value: string) =>
    setMessages((current) => ({ ...current, [itemId]: value }));
  const detail = useQuery({
    queryKey: queryKeys.distribution.runtime('detail', id),
    queryFn: ({ signal }) => api.detail(id!, signal),
    enabled: !!id,
    ...poll,
  });
  const history = useQuery({
    queryKey: queryKeys.distribution.runtime('history', id, historyOffset),
    queryFn: ({ signal }) => api.history(id!, historyOffset, signal),
    enabled: !!id && detail.isSuccess,
    ...poll,
  });
  const mutation = useMutation({
    mutationFn: ({
      item,
      body,
    }: {
      item: QueueItem;
      recovery: boolean;
      body: { action: string; expectedUpdatedAt: string; requestId: string };
    }) => api.action(item.id, body),
    retry: false,
    onSuccess: (_result, variables) => {
      clearPending(variables.item.id);
      setMessage(variables.item.id, 'Запрос принят. Дождитесь подтверждённого результата.');
      void client.invalidateQueries({ queryKey: queryKeys.distribution.all });
    },
    onError: (error, variables) => {
      // A refusal to replay (for example revoked rights) does not prove the original
      // request failed. Keep its identity until a successful receipt resolves it.
      if (
        !variables.recovery &&
        error instanceof ApiError &&
        error.status >= 400 &&
        error.status < 500
      ) {
        clearPending(variables.item.id);
        setMessage(
          variables.item.id,
          error.status === 409
            ? 'Состояние изменилось. Действие не принято: обновите данные и выберите действие заново.'
            : error.message,
        );
      } else
        setMessage(
          variables.item.id,
          'Ответ на действие не получен. Обновите состояние перед повтором; повтор отправляет тот же идентификатор запроса.',
        );
      void client.invalidateQueries({
        queryKey: queryKeys.distribution.runtime('detail', variables.item.id),
        exact: true,
      });
    },
  });
  const run = (action: string) => {
    if (!detail.data || mutation.isPending) return;
    const held = pendingRequests.get(detail.data.id);
    const body = held ?? {
      action,
      expectedUpdatedAt: detail.data.updatedAt,
      requestId: crypto.randomUUID(),
    };
    setPendingRequests((current) => new Map(current).set(detail.data!.id, body));
    mutation.mutate({ item: detail.data, body, recovery: !!held });
  };
  const close = () => {
    onClose();
    setHistoryOffset(0);
    // An in-flight request still belongs to its item when the dialog is closed.
  };
  const users = useQuery({
    queryKey: queryKeys.distribution.runtime('users'),
    queryFn: orgApi.getUsers,
  });
  const employee = (id: string | null | undefined) => {
    const user = users.data?.find((u) => u.id === id);
    return user ? fullName(user) : 'Нет подтверждённых данных';
  };
  const heldRequest = id ? pendingRequests.get(id) : undefined;
  const canManage = actor.data?.role === 'owner' || actor.data?.role === 'admin';
  return (
    <Modal
      open={!!id}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title={
        detail.data?.leadId
          ? `История · ${detail.data.leadName ? `${detail.data.leadName} · №${detail.data.leadId}` : `Сделка №${detail.data.leadId}`}`
          : 'История распределения'
      }
      description="История ожидания и результата распределения."
      size="lg"
      restoreFocusRef={restoreRef}
    >
      <div className="space-y-4">
        {detail.isPending ? (
          <p role="status">Загружаем детали…</p>
        ) : detail.isError ? (
          <Failure error={detail.error} retry={() => void detail.refetch()} />
        ) : (
          detail.data && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StateBadge state={detail.data.state} />
                {detail.data.leadUrl && /^https:\/\//.test(detail.data.leadUrl) && (
                  <a
                    href={detail.data.leadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-primary-700"
                  >
                    Открыть в amoCRM ↗
                  </a>
                )}
              </div>
              <p className="text-sm">{reasonText(detail.data.reason)}</p>
              <p className="text-xs text-slate-500">
                Последнее изменение: {dateText(detail.data.updatedAt, timezone)}
              </p>
              {!isQueueFinished(detail.data.state) && (
                <QueueWaitingInfo item={detail.data} timezone={timezone} />
              )}
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">
                    {isQueueConfirmed(detail.data.state)
                      ? 'Подтверждённый ответственный'
                      : 'Текущий ответственный в amoCRM'}
                  </dt>
                  <dd>
                    {employee(
                      isQueueConfirmed(detail.data.state)
                        ? detail.data.plannedEmployeeId
                        : detail.data.currentEmployeeId,
                    )}
                  </dd>
                </div>
                {isQueueConfirmed(detail.data.state) &&
                  detail.data.currentEmployeeId &&
                  detail.data.currentEmployeeId !== detail.data.plannedEmployeeId && (
                    <div>
                      <dt className="text-slate-500">Сейчас в amoCRM</dt>
                      <dd>{employee(detail.data.currentEmployeeId)}</dd>
                    </div>
                  )}
                {detail.data.previousEmployeeId && (
                  <div>
                    <dt className="text-slate-500">Предыдущий ответственный</dt>
                    <dd>{employee(detail.data.previousEmployeeId)}</dd>
                  </div>
                )}
              </dl>
              {!detail.data.previousEmployeeId && (
                <p className="text-xs text-slate-500">Предыдущий ответственный не зафиксирован.</p>
              )}
              <TechnicalDetails item={detail.data} />
              {canManage && heldRequest && (
                <div className="rounded-md bg-warning-50 p-3 text-sm">
                  <p>
                    Ответ на предыдущее действие не получен. Сначала восстановите результат этого
                    запроса.
                  </p>
                  <Button
                    variant="secondary"
                    className="mt-2"
                    size="sm"
                    loading={mutation.isPending}
                    onClick={() => run(heldRequest.action)}
                  >
                    Восстановить результат действия
                  </Button>
                </div>
              )}
              {canManage && (
                <div className="flex flex-wrap gap-2">
                  {detail.data.actions.map((action) => (
                    <Button
                      key={action}
                      variant={action === 'cancel' ? 'danger' : 'secondary'}
                      size="sm"
                      loading={mutation.isPending && mutation.variables?.body.action === action}
                      disabled={
                        mutation.isPending || (!!heldRequest && heldRequest.action !== action)
                      }
                      onClick={() => run(action)}
                    >
                      {actions[action] ?? action}
                    </Button>
                  ))}
                </div>
              )}
              {message && (
                <p role="status" className="text-sm">
                  {message}
                </p>
              )}
              <h3 className="font-semibold">События</h3>
              {history.isError ? (
                <Failure error={history.error} retry={() => void history.refetch()} />
              ) : history.isPending ? (
                <p role="status">Загружаем историю…</p>
              ) : (
                <ol className="space-y-3">
                  {history.data?.items.map((event) => (
                    <li key={event.id} className="border-l-2 border-slate-200 pl-4">
                      <p className="text-xs text-slate-500">
                        {dateText(event.createdAt, timezone)}
                      </p>
                      <div className="mt-1">
                        <StateBadge state={event.state} />
                      </div>
                      <p className="mt-1 text-sm">{reasonText(event.reason)}</p>
                      <details className="mt-1 text-xs text-slate-500">
                        <summary className="cursor-pointer">Детали события</summary>
                        <p className="mt-1 break-all">
                          Событие {event.id} · состояние: {event.state} · причина: {event.reason}
                        </p>
                      </details>
                    </li>
                  ))}
                </ol>
              )}
              {(historyOffset > 0 || history.data?.hasMore) && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500">
                    Страница событий {Math.floor(historyOffset / 25) + 1}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={historyOffset === 0}
                    onClick={() => setHistoryOffset(Math.max(0, historyOffset - 25))}
                  >
                    Предыдущие события
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!history.data?.hasMore || history.isFetching}
                    onClick={() => setHistoryOffset(historyOffset + 25)}
                  >
                    Следующие события
                  </Button>
                </div>
              )}
            </>
          )
        )}
      </div>
    </Modal>
  );
}

function QueueWaitingInfo({ item, timezone }: { item: QueueItem; timezone?: string | null }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
      <span>
        Следующая смена:{' '}
        {item.nextShiftAt ? dateText(item.nextShiftAt, timezone) : 'пока неизвестна'}
      </span>
      <span>
        Срок ожидания:{' '}
        {item.waitingDeadlineAt
          ? dateText(item.waitingDeadlineAt, timezone)
          : 'не подтверждён сервером'}{' '}
        · максимум 3 дня
      </span>
    </div>
  );
}
function TechnicalDetails({ item }: { item: QueueItem }) {
  const [message, setMessage] = useState('');
  const text = `Запись: ${item.id}\nОперация: ${item.operationId ?? 'не отправлена'}\nВерсия результата: ${item.resultVersion ?? 'не подтверждена'}\nСостояние: ${item.state}\nПричина: ${item.reason}`;
  return (
    <details className="rounded-md bg-surface-muted p-3 text-xs text-slate-500">
      <summary className="cursor-pointer font-medium">Технические детали</summary>
      <pre className="mt-2 whitespace-pre-wrap break-all font-mono">{text}</pre>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="mt-2"
        onClick={() => {
          void copyText(text).then((copied) =>
            setMessage(copied ? 'Скопировано' : 'Копирование недоступно. Выделите текст вручную.'),
          );
        }}
      >
        Копировать детали
      </Button>
      {message && (
        <span role="status" className="ml-2">
          {message}
        </span>
      )}
    </details>
  );
}
