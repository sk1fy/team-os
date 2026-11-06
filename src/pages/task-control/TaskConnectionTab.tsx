import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Check,
  Download,
  History,
  Link2,
  Pencil,
  RefreshCw,
  RotateCcw,
  Settings2,
} from 'lucide-react';
import { taskControlApi as api, type TaskControlConnection } from '@/api/taskControl';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import { readProof } from './model';
import {
  TASK_CONTROL_DESCRIPTION,
  formatDateTime,
  installationText,
  type TaskControlState,
} from './shared';
import { Card, Note, Problem, StatusDot, idNote } from './ui';

/** Вкладка «Подключение»: статус аккаунта и установки, код подключения, журнал. */
export function TaskConnectionTab({ state }: { state: TaskControlState }) {
  const { installed, connection, connections } = state;
  const showLinkForm = installed && !connection && connections.isSuccess;
  return (
    <>
      <PageHeader title="Подключение" description={TASK_CONTROL_DESCRIPTION} />
      <div
        className={cn(
          'grid items-start gap-4',
          (showLinkForm || connection) && 'lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]',
        )}
      >
        <AccountCard state={state} />
        {showLinkForm && <LinkForm state={state} />}
        {connection && <Journal connection={connection} companyId={state.company.data?.id} />}
      </div>
    </>
  );
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-slate-500">{term}</dt>
      <dd className="m-0 min-w-0 text-ink">{children}</dd>
    </>
  );
}

function AccountCard({ state }: { state: TaskControlState }) {
  const { company, account, status, connections, connection, installed } = state;
  const installation = status.data;
  const error = status.error || connections.error;
  return (
    <Card
      title={`Аккаунт amoCRM ${account || 'не подключён'}`}
      actions={
        <Button
          variant="secondary"
          size="sm"
          disabled={!account || status.isFetching}
          onClick={() => {
            void status.refetch();
            void connections.refetch();
          }}
        >
          <RefreshCw
            className={cn('size-4', status.isFetching && 'animate-spin')}
            aria-hidden="true"
          />
          Обновить статус
        </Button>
      }
    >
      <div className="space-y-4">
        {company.isPending ? (
          <p className="text-sm text-slate-500">Загрузка аккаунта…</p>
        ) : company.isError ? (
          <Problem role="alert" title="Не удалось загрузить аккаунт." />
        ) : !account ? (
          <Problem
            title="Подключите аккаунт amoCRM в настройках компании."
            action={
              <Link
                to="/settings"
                className="inline-flex h-8 items-center rounded-md bg-primary-600 px-3 text-[13px] font-semibold text-white hover:bg-primary-700"
              >
                Открыть настройки
              </Link>
            }
          />
        ) : status.isPending ? (
          <p className="text-sm text-slate-500">Проверяем установку…</p>
        ) : (
          <>
            {!installed && (
              <Problem title={installationText(installation?.state)}>
                {installation?.state === 'notInstalled'
                  ? 'Установите виджет «Контроль задач» в amoCRM и обновите статус.'
                  : 'Правила нельзя менять, пока статус установки не подтверждён.'}
              </Problem>
            )}
            <dl className="grid grid-cols-[130px_minmax(0,1fr)] gap-x-3.5 gap-y-2.5 text-[13.5px] max-md:grid-cols-[110px_minmax(0,1fr)]">
              <Row term="Виджет">
                <span className="inline-flex items-center gap-2">
                  <StatusDot
                    tone={
                      installed
                        ? 'green'
                        : installation?.state === 'notInstalled'
                          ? 'none'
                          : 'amber'
                    }
                  />
                  {installed
                    ? 'Виджет установлен'
                    : installation?.state === 'notInstalled'
                      ? 'Не установлен'
                      : 'Статус неизвестен'}
                </span>
              </Row>
              <Row term="Правила TeamOS">
                {connection ? (
                  <span className="inline-flex items-center gap-2">
                    <StatusDot tone="green" />
                    Подключены
                  </span>
                ) : connections.isPending ? (
                  <span className="text-slate-500">Проверяем…</span>
                ) : connections.isError ? (
                  <span className="text-slate-500">Нет данных</span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <StatusDot tone="none" />
                    Не подключены
                  </span>
                )}
              </Row>
              {installation?.runtimeVersion && (
                <Row term="Версия">{installation.runtimeVersion}</Row>
              )}
              {connection && (
                <>
                  <Row term="Компания">
                    <span className={cn(idNote, 'text-[12.5px] break-all')}>
                      {connection.scope.companyId}
                    </span>
                  </Row>
                  <Row term="Установка">
                    <span className={cn(idNote, 'text-[12.5px] break-all')}>
                      {connection.scope.installationId}
                    </span>
                  </Row>
                </>
              )}
              {installation?.checkedAt && (
                <Row term="Проверено">{formatDateTime(installation.checkedAt)}</Row>
              )}
            </dl>
            <p className="text-[13px] leading-relaxed text-slate-500">
              Виджет получает сохранённые правила из TeamOS при следующем обновлении.
            </p>
          </>
        )}
        {error && (
          <Note tone="red" role="alert">
            {error.message}
          </Note>
        )}
      </div>
    </Card>
  );
}

function LinkForm({ state }: { state: TaskControlState }) {
  const { account, connections } = state;
  const [proof, setProof] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Card title="Подключить правила TeamOS">
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          try {
            const p = readProof(proof, 'link', account);
            await api.createTaskControlLinkIntent({
              intentId: p.requestId,
              installationId: p.installationId,
              integrationId: p.integrationId,
              accountId: account,
              coreAssertion: proof.trim(),
            });
            setProof('');
            await connections.refetch();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="text-[13.5px] leading-relaxed text-slate-600">
          В настройках «Контроля задач» в amoCRM получите код подключения и вставьте его сюда в
          течение 60 секунд. Нужны права администратора amoCRM и TeamOS. Автономные правила при
          подключении не меняются.
        </p>
        <div className="space-y-1.5">
          <label htmlFor="task-control-proof" className="text-[13px] font-semibold text-slate-700">
            Код подключения
          </label>
          <input
            id="task-control-proof"
            type="password"
            autoComplete="off"
            className="h-9.5 w-full rounded-md border border-slate-200 bg-surface px-3 text-sm text-ink focus:outline-2 focus:-outline-offset-1 focus:outline-primary-600"
            value={proof}
            onChange={(e) => setProof(e.target.value)}
          />
        </div>
        {error && (
          <Note tone="red" role="alert">
            {error}
          </Note>
        )}
        <Button type="submit" disabled={busy || !proof.trim()} loading={busy}>
          Подключить
        </Button>
      </form>
    </Card>
  );
}

type AuditEntry = Awaited<ReturnType<typeof api.getTaskControlHistory>>['items'][number];

const events: Record<AuditEntry['action'], { title: string; icon: ReactNode; tone?: string }> = {
  link: { title: 'Правила TeamOS подключены', icon: <Link2 className="size-4" /> },
  draftUpdated: { title: 'Правила сохранены', icon: <Pencil className="size-4" /> },
  imported: { title: 'Правила импортированы из amoCRM', icon: <Download className="size-4" /> },
  published: { title: 'Правила опубликованы', icon: <Check className="size-4" />, tone: 'brand' },
  rollbackPublished: {
    title: 'Восстановлена прежняя версия правил',
    icon: <RotateCcw className="size-4" />,
  },
  modeChanged: { title: 'Изменён режим правил', icon: <Settings2 className="size-4" /> },
  revoked: {
    title: 'Подключение отозвано',
    icon: <AlertTriangle className="size-4" />,
    tone: 'amber',
  },
  settingsChanged: { title: 'Изменены настройки', icon: <Settings2 className="size-4" /> },
  runtimeRecomputed: { title: 'Правила виджета обновлены', icon: <RefreshCw className="size-4" /> },
};

/** Журнал — только реальные события из GET /history; без данных карточка не показывается. */
function Journal({
  connection,
  companyId,
}: {
  connection: TaskControlConnection;
  companyId: string | undefined;
}) {
  const bindingId = connection.scope.bindingId;
  const history = useQuery({
    queryKey: ['task-control', companyId, 'history', bindingId],
    queryFn: ({ signal }) => api.getTaskControlHistory(bindingId, { limit: 10 }, signal),
    retry: false,
  });
  const items = Array.isArray(history.data?.items) ? history.data.items : undefined;
  if (history.isError || (history.isSuccess && !items)) return null;
  return (
    <Card title="Журнал" bodyClassName="pt-2">
      {history.isPending ? (
        <p className="py-3 text-sm text-slate-500">Загрузка журнала…</p>
      ) : !items?.length ? (
        <p className="py-3 text-sm text-slate-500">Событий пока нет.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => {
            const event = events[item.action] ?? {
              title: 'Событие подключения',
              icon: <History className="size-4" />,
            };
            return (
              <li key={item.id} className="flex items-center gap-3 py-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-[9px]',
                    event.tone === 'brand'
                      ? 'bg-primary-50 text-primary-600 dark:bg-primary-900 dark:text-primary-200'
                      : event.tone === 'amber'
                        ? 'bg-warning-50 text-warning-700 dark:bg-warning-600/20 dark:text-amber-300'
                        : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {event.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-[550] text-ink">{event.title}</div>
                  <div className="text-xs text-slate-500">
                    {item.actorType === 'system' ? 'Система · ' : ''}
                    {formatDateTime(item.createdAt)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
