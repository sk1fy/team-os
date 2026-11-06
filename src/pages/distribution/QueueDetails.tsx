import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, TriangleAlert, X } from 'lucide-react';
import { httpAuthApi as authApi, httpOrgApi as orgApi } from '@/api/http';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { distributionRuntimeApi as api, type QueueItem } from '@/api/distributionRuntime';
import { Button, Modal } from '@/components/ui';
import { copyText } from '@/lib/clipboard';
import { fullName } from '@/lib/labels';
import { dateText, Failure, reasonText, StateBadge, useVisiblePolling } from './runtimeShared';
import { isQueueConfirmed, isQueueFinished } from './queuePresentation';
import { iconBoxClass, Problem } from './ui';

const actionLabels: Record<string, string> = {
  recalculate: 'Пересчитать',
  check: 'Проверить результат',
  retry: 'Повторить после исправления',
  cancel: 'Отменить',
};

type ActionBody = { action: string; expectedUpdatedAt: string; requestId: string };

/** Карточка сделки очереди: история, ответственные и действия. */
export function QueueDetails({
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
    mutationFn: ({ item, body }: { item: QueueItem; recovery: boolean; body: ActionBody }) =>
      api.action(item.id, body),
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
  const employee = (employeeId: string | null | undefined) => {
    const user = users.data?.find((u) => u.id === employeeId);
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
          <p role="status" className="text-sm text-slate-500">
            Загружаем детали…
          </p>
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
                    className="text-sm font-semibold text-primary-700 hover:underline"
                  >
                    Открыть в amoCRM ↗
                  </a>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-ink">{reasonText(detail.data.reason)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Последнее изменение: {dateText(detail.data.updatedAt, timezone)}
                </p>
                {!isQueueFinished(detail.data.state) && (
                  <QueueWaitingInfo item={detail.data} timezone={timezone} />
                )}
              </div>
              <dl className="grid gap-3 rounded-[10px] border border-slate-200 p-3.5 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-slate-500">
                    {isQueueConfirmed(detail.data.state)
                      ? 'Подтверждённый ответственный'
                      : 'Текущий ответственный в amoCRM'}
                  </dt>
                  <dd className="mt-0.5 font-medium break-words text-ink">
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
                      <dt className="text-xs text-slate-500">Сейчас в amoCRM</dt>
                      <dd className="mt-0.5 font-medium break-words text-ink">
                        {employee(detail.data.currentEmployeeId)}
                      </dd>
                    </div>
                  )}
                {detail.data.previousEmployeeId && (
                  <div>
                    <dt className="text-xs text-slate-500">Предыдущий ответственный</dt>
                    <dd className="mt-0.5 font-medium break-words text-ink">
                      {employee(detail.data.previousEmployeeId)}
                    </dd>
                  </div>
                )}
              </dl>
              {!detail.data.previousEmployeeId && (
                <p className="text-xs text-slate-500">Предыдущий ответственный не зафиксирован.</p>
              )}
              <TechnicalDetails item={detail.data} />
              {canManage && heldRequest && (
                <Problem
                  role={false}
                  action={
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={mutation.isPending}
                      onClick={() => run(heldRequest.action)}
                    >
                      Восстановить результат действия
                    </Button>
                  }
                >
                  Ответ на предыдущее действие не получен. Сначала восстановите результат этого
                  запроса.
                </Problem>
              )}
              {canManage && detail.data.actions.length > 0 && (
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
                      {actionLabels[action] ?? action}
                    </Button>
                  ))}
                </div>
              )}
              {message && (
                <p role="status" className="text-sm text-ink">
                  {message}
                </p>
              )}
              <h3 className="text-[15px] font-semibold text-ink">События</h3>
              {history.isError ? (
                <Failure error={history.error} retry={() => void history.refetch()} />
              ) : history.isPending ? (
                <p role="status" className="text-sm text-slate-500">
                  Загружаем историю…
                </p>
              ) : (
                <ol>
                  {history.data?.items.map((event) => (
                    <li
                      key={event.id}
                      className="flex items-start gap-3 border-b border-slate-100 py-3 last:border-b-0"
                    >
                      <span className={iconBoxClass(eventTone(event.state))} aria-hidden="true">
                        <EventIcon state={event.state} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <StateBadge state={event.state} />
                          <span className="text-xs text-slate-500">
                            {dateText(event.createdAt, timezone)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-ink">{reasonText(event.reason)}</p>
                        <details className="mt-1 text-xs text-slate-500">
                          <summary className="cursor-pointer">Детали события</summary>
                          <p className="mt-1 break-all">
                            Событие {event.id} · состояние: {event.state} · причина: {event.reason}
                          </p>
                        </details>
                      </div>
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

function eventTone(state: string) {
  if (isQueueConfirmed(state)) return 'green' as const;
  if (['failed', 'error'].includes(state)) return 'red' as const;
  return 'neutral' as const;
}

function EventIcon({ state }: { state: string }) {
  if (isQueueConfirmed(state)) return <Check className="size-4" />;
  if (['failed', 'error'].includes(state)) return <TriangleAlert className="size-4" />;
  if (state === 'cancelled') return <X className="size-4" />;
  return <Clock className="size-4" />;
}

/** Следующая смена и срок ожидания для незавершённой сделки. */
export function QueueWaitingInfo({
  item,
  timezone,
}: {
  item: QueueItem;
  timezone?: string | null;
}) {
  return (
    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
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
    <details className="rounded-[10px] bg-surface-muted p-3 text-xs text-slate-500">
      <summary className="cursor-pointer font-medium">Технические детали</summary>
      <pre className="mt-2 font-mono break-all whitespace-pre-wrap">{text}</pre>
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
