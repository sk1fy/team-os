import type { ReactNode } from 'react';
import { AlertTriangle, PlugZap, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ActivityConnection } from '@/api/activityControl';
import { tabHref } from '@/components/layout/navigation';
import { Badge, Button } from '@/components/ui';
import { Card, Failure } from './shared';
import { ACTIVITY_PATH, employeesLabel } from './model';

const checkedFormat = new Intl.DateTimeFormat('ru', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const STATE = {
  configured: { label: 'Подключено', variant: 'success' },
  unconfigured: { label: 'Не настроено', variant: 'warning' },
  unavailable: { label: 'Недоступно', variant: 'danger' },
} as const;

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-slate-500">{term}</dt>
      <dd className="m-0 min-w-0 break-words text-ink">{children}</dd>
    </>
  );
}

function CheckButton({ checking, onCheck }: { checking: boolean; onCheck: () => void }) {
  return (
    <Button size="sm" variant="secondary" loading={checking} onClick={onCheck}>
      {!checking && <RefreshCw className="size-3.5" />}
      Проверить подключение
    </Button>
  );
}

/** Вкладка «Подключение» (`connBody()` концепта): состояние Activity и аккаунт amoCRM. */
export function ConnectionTab({
  connection,
  checkedAt,
  checking,
  error,
  onCheck,
  employees,
}: {
  connection: ActivityConnection;
  checkedAt: number;
  checking: boolean;
  error?: unknown;
  onCheck: () => void;
  employees?: number;
}) {
  const state = STATE[connection.state];
  const configured = connection.state === 'configured' ? connection : null;
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Card
        title={configured ? `Аккаунт amoCRM ${configured.scope.accountId}` : 'Подключение Activity'}
        action={<CheckButton checking={checking} onCheck={onCheck} />}
      >
        <div className="flex flex-col gap-4">
          {error != null && <Failure error={error} title="Не удалось проверить подключение" />}
          {connection.state !== 'configured' && (
            <div className="flex gap-3 rounded-[10px] bg-warning-50 px-3.5 py-3 text-[13.5px] text-warning-700 dark:bg-warning-600/20 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                <b className="font-semibold">
                  {connection.state === 'unavailable'
                    ? 'Activity сейчас недоступна'
                    : 'Activity не настроена'}
                </b>
                <p className="mt-0.5">{connection.message}</p>
              </div>
            </div>
          )}
          <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3.5 gap-y-2.5 text-[13.5px] sm:grid-cols-[130px_minmax(0,1fr)]">
            <Row term="Activity">
              <Badge variant={state.variant}>{state.label}</Badge>
            </Row>
            {configured && (
              <>
                <Row term="Аккаунт amoCRM">{configured.scope.accountId}</Row>
                <Row term="Установка">
                  <span className="font-mono text-xs">{configured.scope.installationId}</span>
                </Row>
              </>
            )}
            {employees != null && (
              <Row term="Сотрудники">{employeesLabel(employees)} в справочнике amoCRM</Row>
            )}
            {checkedAt > 0 && <Row term="Проверено">{checkedFormat.format(checkedAt)}</Row>}
          </dl>
          <p className="text-xs text-slate-500">
            Настройки дашбордов и панели задач общие с виджетом Activity в amoCRM.
          </p>
        </div>
      </Card>
    </div>
  );
}

/** Состояние вкладок «Дашборды» и «Панель задач», пока Activity не подключена. */
export function NotConnected({
  message,
  checking,
  onCheck,
}: {
  message: string;
  checking: boolean;
  onCheck: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-surface px-5 py-11 text-center shadow-card">
      <span className="mx-auto grid size-11 place-items-center rounded-xl bg-warning-50 text-warning-700 dark:bg-warning-600/20 dark:text-amber-300">
        <PlugZap className="size-5" />
      </span>
      <h2 className="mt-3 font-semibold text-ink">Нет подключения к Activity</h2>
      <p className="mx-auto mt-1 max-w-md text-[13px] text-slate-500">{message}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <CheckButton checking={checking} onCheck={onCheck} />
        <Link
          to={tabHref(ACTIVITY_PATH, 'connection', 'dashboards')}
          className="inline-flex h-8 items-center rounded-md bg-primary-600 px-3 text-[13px] font-semibold text-white transition-colors hover:bg-primary-700"
        >
          Открыть подключение
        </Link>
      </div>
    </div>
  );
}

/** Ссылка на устаревшую версию SSD — внизу вкладки «Подключение», без акцента. */
export function LegacyLink() {
  return (
    <p className="mt-2 text-xs text-slate-500">
      <Link className="underline underline-offset-2 hover:text-slate-700" to="/legacy/ssd-activity">
        Устаревшая версия SSD (отдельные настройки)
      </Link>
    </p>
  );
}
