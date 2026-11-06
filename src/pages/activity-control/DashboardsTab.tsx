import { useState, type MouseEvent, type ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import {
  Activity,
  Clock,
  Copy,
  ExternalLink,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import type { ActivityDirectory, ActivityPanel } from '@/api/activityControl';
import type { components } from '@/api/generated/teamos';
import { Avatar, Button } from '@/components/ui';
import { copyText } from '@/lib/clipboard';
import { cn } from '@/lib/cn';
import { toast } from '@/stores/toast';
import { Failure, Note } from './shared';
import { employeesLabel } from './model';

type Panels = components['schemas']['ActivityPanels'];

const stop = (event: MouseEvent) => event.stopPropagation();

function Tag({
  tone = 'gray',
  children,
}: {
  tone?: 'gray' | 'green' | 'amber';
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[5px] px-1.5 py-px text-[11px] font-semibold whitespace-nowrap',
        tone === 'gray' && 'bg-slate-100 text-slate-600',
        tone === 'green' &&
          'bg-success-50 text-success-700 dark:bg-success-600/20 dark:text-green-300',
        tone === 'amber' &&
          'bg-warning-50 text-warning-700 dark:bg-warning-600/20 dark:text-amber-300',
      )}
    >
      {children}
    </span>
  );
}

const iconButton =
  'grid size-7 shrink-0 place-items-center rounded-md text-slate-500 transition-colors hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-primary-600';

/** Строка ссылки доступа: ссылка видна только сразу после выдачи или замены. */
function ShareRow({
  panel,
  url,
  onShare,
}: {
  panel: ActivityPanel;
  url?: string;
  onShare: () => void;
}) {
  if (url)
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1 rounded-[9px] bg-slate-100 py-1 pr-1 pl-3 text-[12.5px] text-slate-600">
          <span className="min-w-0 flex-1 truncate" title={url}>
            {url}
          </span>
          <button
            type="button"
            className={iconButton}
            aria-label="Скопировать ссылку"
            title="Скопировать ссылку"
            onClick={(event) => {
              stop(event);
              void copyText(url).then((ok) =>
                ok ? toast.success('Ссылка скопирована') : toast.error('Не удалось скопировать'),
              );
            }}
          >
            <Copy className="size-3.5" />
          </button>
          <a
            className={iconButton}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Открыть панель"
            title="Открыть панель"
            onClick={stop}
          >
            <ExternalLink className="size-3.5" />
          </a>
          <button
            type="button"
            className={iconButton}
            aria-label="Новая ссылка"
            title="Заменить ссылку"
            onClick={(event) => {
              stop(event);
              onShare();
            }}
          >
            <RefreshCw className="size-3.5" />
          </button>
        </div>
        <p className="text-xs text-warning-700 dark:text-amber-300">
          Сохраните ссылку: она показывается только после создания или замены.
        </p>
      </div>
    );
  return (
    <div className="flex items-center gap-2 rounded-[9px] bg-slate-100 py-1 pr-1 pl-3 text-[12.5px] text-slate-500">
      <Lock className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">
        {panel.shareUrlIssued ? 'Ссылка выдана и скрыта' : 'Ссылка ещё не выдана'}
      </span>
      <button
        type="button"
        className="h-7 shrink-0 rounded-md px-2.5 text-xs font-semibold text-primary-700 transition-colors hover:bg-surface dark:text-primary-200"
        onClick={(event) => {
          stop(event);
          onShare();
        }}
      >
        {panel.shareUrlIssued ? 'Новая ссылка' : 'Выдать ссылку'}
      </button>
    </div>
  );
}

function DashboardCard({
  panel,
  names,
  url,
  canEdit,
  onEdit,
  onShare,
}: {
  panel: ActivityPanel;
  names: Map<number, string> | null;
  url?: string;
  canEdit: boolean;
  onEdit: () => void;
  onShare: () => void;
}) {
  const people = panel.employeeIds;
  const plans = panel.options.operators.filter(
    (item) => item.enabled && people.includes(item.employeeId),
  ).length;
  const pipelines = panel.options.pipelineIds.length;
  return (
    <article
      onClick={canEdit ? onEdit : undefined}
      className={cn(
        'flex flex-col rounded-xl border border-slate-200 bg-surface shadow-card transition-colors',
        canEdit && 'cursor-pointer hover:border-slate-300 dark:hover:border-slate-500',
      )}
    >
      <div className="flex items-start gap-2.5 border-b border-slate-100 px-[18px] pt-4 pb-3.5">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15.5px] font-semibold text-ink">{panel.name}</h3>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="size-3.5 shrink-0" />
            <span className="truncate">
              {panel.displayWindow.from}–{panel.displayWindow.to} · {panel.timezone}
            </span>
          </div>
        </div>
        <button
          type="button"
          aria-label="Настроить"
          title="Настроить"
          disabled={!canEdit}
          onClick={(event) => {
            stop(event);
            onEdit();
          }}
          className="grid size-8 shrink-0 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Pencil className="size-4" />
        </button>
      </div>
      <div className="flex flex-col gap-3 px-[18px] pt-3.5 pb-4">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex min-w-0" aria-hidden="true">
            {names &&
              people
                .slice(0, 4)
                .map((id) => (
                  <Avatar
                    key={id}
                    name={names.get(id) ?? '?'}
                    size="xs"
                    className="-ml-1.5 ring-2 ring-surface first:ml-0"
                  />
                ))}
            {names && people.length > 4 && (
              <span className="-ml-1.5 grid size-6 place-items-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600 ring-2 ring-surface">
                +{people.length - 4}
              </span>
            )}
          </div>
          <span className="shrink-0 text-xs text-slate-500">{employeesLabel(people.length)}</span>
        </div>
        <ShareRow panel={panel} url={url} onShare={onShare} />
        <div className="flex flex-wrap gap-1.5">
          <Tag tone={panel.enabled ? 'green' : 'amber'}>
            {panel.enabled ? 'Включена' : 'Отключена'}
          </Tag>
          <Tag>{pipelines ? `Воронок: ${pipelines}` : 'Все воронки'}</Tag>
          {plans > 0 && <Tag>План звонков: {plans}</Tag>}
        </div>
      </div>
    </article>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5">
      <p role="status" className="sr-only">
        Загрузка дашбордов…
      </p>
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          aria-hidden="true"
          className="h-[200px] animate-pulse rounded-xl border border-slate-200 bg-surface p-[18px]"
        >
          <div className="h-4 w-2/3 rounded bg-slate-100" />
          <div className="mt-2 h-3 w-1/3 rounded bg-slate-100" />
          <div className="mt-8 h-8 rounded-[9px] bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

/** Вкладка «Дашборды» (`dashBody()` концепта): подсказка, поиск и сетка карточек. */
export function DashboardsTab({
  panels,
  directory,
  issued,
  onCreate,
  onEdit,
  onShare,
}: {
  panels: UseQueryResult<Panels>;
  directory: UseQueryResult<ActivityDirectory>;
  issued: Record<string, string>;
  onCreate: () => void;
  onEdit: (panel: ActivityPanel) => void;
  onShare: (panel: ActivityPanel) => void;
}) {
  const [search, setSearch] = useState('');
  const all = panels.data?.panels ?? [];
  const query = search.trim().toLowerCase();
  const shown = all.filter((panel) => panel.name.toLowerCase().includes(query));
  const names = directory.data
    ? new Map(directory.data.users.map((user) => [user.id, user.name]))
    : null;
  const canEdit = Boolean(directory.data);
  return (
    <div className="flex flex-col gap-4">
      <Note tone="brand">
        Создайте дашборд, выберите сотрудников и откройте его по ссылке на отдельном мониторе или на
        рабочем столе amoCRM. Ссылка даёт доступ всем, у кого она есть; отзыв роли в TeamOS её не
        отзывает.
      </Note>
      {panels.error && <Failure error={panels.error} reload={() => void panels.refetch()} />}
      {directory.error && (
        <Failure error={directory.error} reload={() => void directory.refetch()} />
      )}
      {all.length > 0 && (
        <label className="relative block w-full max-w-[320px]">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            aria-label="Поиск дашбордов"
            placeholder="Поиск по названию"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9.5 w-full rounded-md border border-slate-200 bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-slate-400 focus:outline-2 focus:-outline-offset-1 focus:outline-primary-600"
          />
        </label>
      )}
      {panels.isPending ? (
        <SkeletonGrid />
      ) : shown.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5">
          {shown.map((panel) => (
            <DashboardCard
              key={panel.id}
              panel={panel}
              names={names}
              url={issued[panel.id]}
              canEdit={canEdit}
              onEdit={() => onEdit(panel)}
              onShare={() => onShare(panel)}
            />
          ))}
        </div>
      ) : all.length > 0 ? (
        <p className="py-11 text-center text-sm text-slate-500">Ничего не нашли</p>
      ) : panels.data ? (
        <div className="rounded-xl border border-slate-200 bg-surface px-5 py-11 text-center shadow-card">
          <Activity className="mx-auto size-6 text-slate-400" />
          <h3 className="mt-2 font-semibold text-ink">Пока нет дашбордов</h3>
          <p className="mt-1 mb-3.5 text-[13px] text-slate-500">
            Дашборд показывает звонки и задачи менеджеров в реальном времени.
          </p>
          <Button onClick={onCreate} disabled={!canEdit}>
            <Plus className="size-4" />
            Новый дашборд
          </Button>
        </div>
      ) : null}
    </div>
  );
}
