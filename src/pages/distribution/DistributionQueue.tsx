import { useRef, useState } from 'react';
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
import { fullName } from '@/lib/labels';
import {
  dateText,
  Failure,
  panelClass,
  reasonText,
  StateBadge,
  useVisiblePolling,
} from './runtimeShared';
const tabs = [
  ['waiting', 'Ожидают'],
  ['assigning', 'Назначаются'],
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
  const filter = {
    tab,
    groupId: selectedGroup || undefined,
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(to).toISOString() : undefined,
    offset,
  };
  const queue = useQuery({
    queryKey: queryKeys.distribution.runtime('queue', filter),
    queryFn: ({ signal }) => api.queue(filter, signal),
    ...poll,
  });
  const summary = useQuery({
    queryKey: queryKeys.distribution.runtime('summary', selectedGroup || undefined),
    queryFn: ({ signal }) => api.summary(selectedGroup || undefined, signal),
    ...poll,
  });
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
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['Ожидают', summary.data?.waiting],
              ['Назначаются', summary.data?.assigning],
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
      {queue.isPending && <p role="status">Загружаем очередь…</p>}
      {queue.isError && <Failure error={queue.error} retry={() => void queue.refetch()} />}
      {queue.data?.items.length === 0 && !queue.isError && (
        <p
          role="status"
          className="rounded-md bg-surface-muted p-6 text-center text-sm text-slate-500"
        >
          В этой части очереди пока нет сделок.
        </p>
      )}
      {!queue.isError && (
        <div
          role="tabpanel"
          id={`distribution-panel-${groupId ?? 'all'}`}
          aria-labelledby={`distribution-tab-${groupId ?? 'all'}-${tab}`}
          className="space-y-3"
        >
          {queue.data?.items.map((item) => (
            <article key={item.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <button
                    onClick={(event) => {
                      restoreRef.current = event.currentTarget;
                      setSelected(item.id);
                    }}
                    className="text-left font-semibold text-primary-700 hover:underline"
                  >
                    {item.leadId
                      ? (item.leadName ?? `Сделка №${item.leadId}`)
                      : 'Сделка · подробности ограничены правами'}
                  </button>
                  <p className="mt-1 text-xs text-slate-500">
                    {groups.find((g) => g.id === item.groupId)?.name ?? 'Группа распределения'}
                  </p>
                </div>
                <StateBadge state={item.state} />
              </div>
              <p className="mt-3 text-sm">{reasonText(item.reason)}</p>
              <dl className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                <div>
                  <dt>
                    {['confirmed', 'succeeded', 'completed', 'kept'].includes(item.state)
                      ? 'Подтверждённый ответственный'
                      : 'Планируемый ответственный'}
                  </dt>
                  <dd>{employee(item.plannedEmployeeId)}</dd>
                </div>
                <div>
                  <dt>
                    {[
                      'confirmed',
                      'succeeded',
                      'completed',
                      'kept',
                      'cancelled',
                      'failed',
                    ].includes(item.state)
                      ? 'Длительность'
                      : 'В очереди'}
                  </dt>
                  <dd>
                    {Math.max(
                      0,
                      Math.floor(
                        (([
                          'confirmed',
                          'succeeded',
                          'completed',
                          'kept',
                          'cancelled',
                          'failed',
                        ].includes(item.state)
                          ? Date.parse(item.updatedAt)
                          : Date.now()) -
                          Date.parse(item.createdAt)) /
                          60000,
                      ),
                    )}{' '}
                    мин.
                  </dd>
                  <dt>Поступила</dt>
                  <dd>{dateText(item.createdAt, summary.data?.timezone)}</dd>
                </div>
                <div>
                  <dt>Следующая проверка</dt>
                  <dd>
                    {[
                      'confirmed',
                      'succeeded',
                      'completed',
                      'kept',
                      'cancelled',
                      'failed',
                    ].includes(item.state)
                      ? '—'
                      : dateText(item.nextAttemptAt, summary.data?.timezone)}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Последнее обновление:{' '}
          {queue.dataUpdatedAt ? dateText(new Date(queue.dataUpdatedAt).toISOString()) : '—'}
          {queue.isError ? ' · данные недоступны' : ''}
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={offset === 0 || queue.isFetching}
            onClick={() => setOffset(Math.max(0, offset - 25))}
          >
            Назад
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!queue.data?.hasMore || queue.isFetching}
            onClick={() => setOffset(offset + 25)}
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
      void detail.refetch();
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
      title="История распределения"
      description="Состояния и операции, сохранённые сервером."
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
              <StateBadge state={detail.data.state} />
              <p>{reasonText(detail.data.reason)}</p>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Текущий ответственный</dt>
                  <dd>{employee(detail.data.currentEmployeeId)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Предыдущий ответственный</dt>
                  <dd>{employee(detail.data.previousEmployeeId)}</dd>
                </div>
              </dl>
              {detail.data.operationId && (
                <p className="break-all text-xs text-slate-500">
                  Операция: {detail.data.operationId} · версия результата:{' '}
                  {detail.data.resultVersion ?? 'пока не подтверждена'}
                </p>
              )}
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
              {!detail.data.leadUrl && (
                <p className="text-xs text-slate-500">Ссылка на amoCRM пока недоступна.</p>
              )}
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
                    </li>
                  ))}
                </ol>
              )}
              <div className="flex gap-2">
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
                  disabled={!history.data?.hasMore && history.data?.items.length !== 25}
                  onClick={() => setHistoryOffset(historyOffset + 25)}
                >
                  Следующие события
                </Button>
              </div>
            </>
          )
        )}
      </div>
    </Modal>
  );
}
