import { useState } from 'react';
import { ActivityOptionsEditor } from './ActivityOptionsEditor';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { ExternalLink, Monitor, Plus, Search } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { authApi } from '@/api';
import { queryKeys } from '@/api/queryKeys';
import { ApiError } from '@/api/client';
import {
  activityControlApi as api,
  type ActivityPanel,
  type ActivityPanelInput,
  type ActivityTaskPanel,
  type ActivityDirectory,
  type ActivityScope,
} from '@/api/activityControl';
import { PageHeader } from '@/components/layout/PageHeader';
import { ErrorState } from '@/components/layout/ErrorState';
import { Button, Input, Modal, Switch, Tabs } from '@/components/ui';
import { toast } from '@/stores/toast';
import { ProductNavigation } from '@/components/integrations/ProductNavigation';

const emptyPanel = (): ActivityPanelInput => ({
  name: '',
  employeeIds: [],
  displayWindow: { from: '09:00', to: '18:00' },
  enabled: true,
  options: { pipelineIds: [], operators: [], departments: [] },
});
function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Не удалось выполнить запрос';
}
function Failure({ error, reload }: { error: unknown; reload?: () => void }) {
  const location = useLocation();
  if (error instanceof ApiError && error.status === 401)
    return (
      <div role="alert" className="space-y-2 rounded-lg border border-slate-200 p-4">
        <p>Сессия истекла. Скопируйте черновик перед повторным входом.</p>
        <Link className="text-primary-600 underline" to="/auth/login" state={{ from: location }}>
          Войти снова
        </Link>
      </div>
    );
  return (
    <ErrorState
      description={errorMessage(error)}
      onRetry={error instanceof ApiError && error.status === 403 ? undefined : reload}
    />
  );
}
function Employees({
  directory,
  selected,
  change,
}: {
  directory: ActivityDirectory;
  selected: number[];
  change: (ids: number[]) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-semibold">Сотрудники amoCRM</legend>
      {directory.users.length === 0 ? (
        <p className="text-sm text-slate-500">Сотрудников нет в доступном справочнике.</p>
      ) : (
        directory.users.map((user) => (
          <label key={user.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(user.id)}
              onChange={(e) =>
                change(
                  e.target.checked
                    ? [...selected, user.id]
                    : selected.filter((id) => id !== user.id),
                )
              }
            />
            {user.name}
            <span className="text-slate-500">{user.groupName}</span>
          </label>
        ))
      )}
    </fieldset>
  );
}
function PanelEditor({
  panel,
  directory,
  save,
  close,
}: {
  panel?: ActivityPanel;
  directory: ActivityDirectory;
  save: (input: ActivityPanelInput, key: string) => Promise<void>;
  close: () => void;
}) {
  const [draft, setDraft] = useState<ActivityPanelInput>(() =>
    panel
      ? {
          name: panel.name,
          employeeIds: panel.employeeIds,
          displayWindow: panel.displayWindow,
          enabled: panel.enabled,
          options: panel.options,
        }
      : emptyPanel(),
  );
  const [command, setCommand] = useState<{ input: ActivityPanelInput; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const submitted = command ?? { input: structuredClone(draft), id: crypto.randomUUID() };
      setCommand(submitted);
      await save(submitted.input, submitted.id);
      close();
    } catch (e) {
      if (e instanceof ApiError && e.status < 500 && e.status !== 429) setCommand(null);
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
      title={panel ? 'Настройки панели' : 'Новая панель'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={close}>
            Отмена
          </Button>
          <Button
            disabled={busy || !draft.name.trim() || !draft.employeeIds.length}
            onClick={() => void submit()}
          >
            {busy ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error != null && <Failure error={error} />}
        {command && !busy && (
          <p className="text-sm text-slate-600">
            Результат отправки не подтверждён. Повтор сохранения отправит те же настройки с тем же
            номером операции.
          </p>
        )}
        <fieldset disabled={busy || command !== null} className="space-y-5">
          <Input
            label="Название панели"
            value={draft.name}
            maxLength={120}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <Switch
            aria-label="Панель включена"
            label="Панель включена"
            checked={draft.enabled}
            onCheckedChange={(enabled) => setDraft({ ...draft, enabled })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Начало дня"
              type="time"
              value={draft.displayWindow.from}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  displayWindow: { ...draft.displayWindow, from: e.target.value },
                })
              }
            />
            <Input
              label="Конец дня"
              type="time"
              value={draft.displayWindow.to}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  displayWindow: { ...draft.displayWindow, to: e.target.value },
                })
              }
            />
          </div>
          <Employees
            directory={directory}
            selected={draft.employeeIds}
            change={(employeeIds) =>
              setDraft({
                ...draft,
                employeeIds,
                options: {
                  ...draft.options,
                  operators: draft.options.operators.filter((x) =>
                    employeeIds.includes(x.employeeId),
                  ),
                },
              })
            }
          />
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Воронки</legend>
            {directory.pipelines.map((pipeline) => (
              <label key={pipeline.id} className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.options.pipelineIds.includes(pipeline.id)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      options: {
                        ...draft.options,
                        pipelineIds: e.target.checked
                          ? [...draft.options.pipelineIds, pipeline.id]
                          : draft.options.pipelineIds.filter((id) => id !== pipeline.id),
                      },
                    })
                  }
                />
                {pipeline.name}
              </label>
            ))}
            <p className="text-xs text-slate-500">Без выбора учитываются все доступные воронки.</p>
          </fieldset>
          <ActivityOptionsEditor
            directory={directory}
            employees={draft.employeeIds}
            value={draft.options}
            change={(options) => setDraft({ ...draft, options })}
          />
          <p className="text-xs text-slate-500">
            Telegram в новой Activity пока недоступен. Настройки панели общие с виджетом amoCRM.
          </p>
        </fieldset>
      </div>
    </Modal>
  );
}
function priorityLabel(key: string) {
  const labels: Record<string, string> = {
    urgent: 'Срочные',
    overdue: 'Просроченные',
    overdue_no_time: 'Просроченные без времени',
    today_no_time: 'На сегодня без времени',
    today_timed: 'На сегодня со временем',
    future: 'Будущие',
  };
  return labels[key] ?? key;
}
function TaskPanelEditor({
  bindingId,
  initial,
  directory,
  saved,
}: {
  bindingId: string;
  initial: ActivityTaskPanel;
  directory: ActivityDirectory;
  saved: (value: ActivityTaskPanel) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function save() {
    setBusy(true);
    setError(null);
    try {
      const value = await api.forBinding(bindingId).saveTaskPanel(draft);
      setDraft(value);
      saved(value);
      toast.success('Настройки сохранены');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <fieldset
      disabled={busy}
      className="max-w-2xl space-y-5 rounded-xl border border-slate-200 bg-surface p-5"
    >
      {error != null && <Failure error={error} />}
      <p className="text-sm text-slate-600">
        Панель задач сотрудников в виджете Activity. Правила продукта «Контроль задач» находятся в
        отдельном разделе.
      </p>
      <Switch
        aria-label="Панель задач включена"
        label="Панель задач включена"
        checked={draft.enabled}
        onCheckedChange={(enabled) => setDraft({ ...draft, enabled })}
        disabled={busy}
      />
      <Switch
        aria-label="Учитывать будущие задачи"
        label="Учитывать будущие задачи"
        checked={draft.considerFutureTasks}
        onCheckedChange={(considerFutureTasks) => setDraft({ ...draft, considerFutureTasks })}
        disabled={busy}
      />
      <Switch
        aria-label="Учитывать связанные сделки"
        label="Учитывать связанные сделки"
        checked={draft.includeRelatedDeals}
        onCheckedChange={(includeRelatedDeals) => setDraft({ ...draft, includeRelatedDeals })}
        disabled={busy}
      />
      <Employees
        directory={directory}
        selected={draft.employeeIds}
        change={(employeeIds) => setDraft({ ...draft, employeeIds })}
      />
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Порядок приоритетов</legend>
        {draft.priorityKeys.map((key, index) => (
          <div key={key} className="flex items-center gap-2 text-sm">
            <span>{priorityLabel(key)}</span>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || index === 0}
              onClick={() => {
                const keys = [...draft.priorityKeys];
                const prior = keys[index - 1];
                if (prior !== undefined) {
                  keys[index - 1] = key;
                  keys[index] = prior;
                  setDraft({ ...draft, priorityKeys: keys });
                }
              }}
            >
              Выше
            </Button>
          </div>
        ))}
      </fieldset>
      <Button disabled={busy} onClick={() => void save()}>
        {busy ? 'Сохранение…' : 'Сохранить настройки'}
      </Button>
    </fieldset>
  );
}
function ConnectedActivity({ scope, bindingId }: { scope: ActivityScope; bindingId: string }) {
  const bound = api.forBinding(bindingId);
  const cache = useQueryClient();
  const key = [
    'activity-control',
    scope.companyId,
    scope.installationId,
    scope.integrationId,
    scope.accountId,
  ];
  const panels = useQuery({
    queryKey: [...key, 'panels'],
    queryFn: ({ signal }) => bound.panels(signal),
    retry: false,
  });
  const directory = useQuery({
    queryKey: [...key, 'employees'],
    queryFn: ({ signal }) => bound.employees(signal),
    retry: false,
  });
  const tasks = useQuery({
    queryKey: [...key, 'task-panel'],
    queryFn: ({ signal }) => bound.taskPanel(signal),
    retry: false,
  });
  const [editor, setEditor] = useState<
    { kind: 'create' } | { kind: 'edit'; panel: ActivityPanel } | null
  >(null);
  const [search, setSearch] = useState('');
  const [share, setShare] = useState<{ panel: ActivityPanel; commandId: string } | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState<unknown>(null);
  const [issued, setIssued] = useState<Record<string, string>>({});
  function remember(panel: ActivityPanel) {
    const url = panel.shareUrl;
    if (url) setIssued((prev) => ({ ...prev, [panel.id]: url }));
    void cache.invalidateQueries({ queryKey: [...key, 'panels'] });
  }
  async function rotate() {
    if (!share) return;
    setShareBusy(true);
    setShareError(null);
    try {
      remember(await bound.rotate(share.panel.id, share.commandId));
      setShare(null);
    } catch (e) {
      setShareError(e);
    } finally {
      setShareBusy(false);
    }
  }
  const denied = [panels.error, directory.error, tasks.error].find(
    (error) => error instanceof ApiError && (error.status === 401 || error.status === 403),
  );
  if (denied) return <Failure error={denied} />;
  const content = (
    <div className="space-y-5">
      <div className="rounded-lg border border-primary-100 bg-primary-50/60 p-4 text-sm text-primary-800">
        Создайте панель для отдельного монитора или рабочего стола amoCRM. Ссылка даёт доступ всем,
        у кого она есть. Отзыв роли TeamOS не отзывает выданную ссылку.
      </div>
      <div className="flex flex-col justify-between gap-3 sm:flex-row">
        <Button onClick={() => setEditor({ kind: 'create' })} disabled={!directory.data}>
          <Plus className="size-4" />
          Новая панель
        </Button>
        <div className="flex items-center gap-2">
          <Search className="size-4" />
          <Input
            aria-label="Поиск панелей"
            placeholder="Поиск по названию"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      {panels.isPending && <p role="status">Загрузка панелей…</p>}
      {panels.error && <Failure error={panels.error} reload={() => void panels.refetch()} />}
      {directory.error && (
        <Failure error={directory.error} reload={() => void directory.refetch()} />
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {panels.data?.panels
          .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
          .map((panel) => (
            <article
              key={panel.id}
              className="space-y-4 rounded-xl border border-slate-200 bg-surface p-5"
            >
              <div className="flex items-center gap-3">
                <Monitor className="size-5 text-primary-600" />
                <h2 className="font-semibold">{panel.name}</h2>
                <span className="ml-auto text-xs text-slate-500">
                  {panel.enabled ? 'Включена' : 'Отключена'}
                </span>
              </div>
              <p className="text-sm text-slate-600">
                Сотрудников: {panel.employeeIds.length} · {panel.displayWindow.from}–
                {panel.displayWindow.to} · {panel.timezone}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  disabled={!directory.data}
                  onClick={() => setEditor({ kind: 'edit', panel })}
                >
                  Настроить
                </Button>
                {issued[panel.id] && (
                  <a
                    className="inline-flex items-center gap-1 text-sm text-primary-600"
                    href={issued[panel.id]}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="size-4" />
                    Открыть панель
                  </a>
                )}
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShare({ panel, commandId: crypto.randomUUID() });
                    setShareError(null);
                  }}
                >
                  Новая ссылка
                </Button>
              </div>
              {issued[panel.id] && (
                <Input label="Ссылка доступа" readOnly value={issued[panel.id]} />
              )}
              <p className="text-xs text-slate-500">
                Ссылка показывается только после создания или замены. Сохраните её у себя.
              </p>
            </article>
          ))}
      </div>
      {panels.data?.panels.length === 0 && (
        <p className="py-8 text-center text-slate-500">Панелей пока нет. Создайте первую панель.</p>
      )}
    </div>
  );
  return (
    <>
      <p className="text-xs text-slate-500">
        Аккаунт amoCRM {scope.accountId} · Установка {scope.installationId}
      </p>
      <Tabs
        items={[
          { value: 'panels', label: 'Панели активности', content },
          {
            value: 'tasks',
            label: 'Панель задач виджета',
            content: (
              <div className="space-y-4">
                {(tasks.error || directory.error) && (
                  <Failure
                    error={tasks.error || directory.error}
                    reload={() => {
                      void tasks.refetch();
                      void directory.refetch();
                    }}
                  />
                )}
                {tasks.data && directory.data ? (
                  <TaskPanelEditor
                    bindingId={bindingId}
                    key={scope.installationId}
                    initial={tasks.data}
                    directory={directory.data}
                    saved={(value) => cache.setQueryData([...key, 'task-panel'], value)}
                  />
                ) : !tasks.error && !directory.error ? (
                  <p role="status">Загрузка настроек…</p>
                ) : null}
              </div>
            ),
          },
        ]}
      />
      {editor && directory.data && (
        <PanelEditor
          key={editor.kind === 'edit' ? editor.panel.id : 'create'}
          panel={editor.kind === 'edit' ? editor.panel : undefined}
          directory={directory.data}
          close={() => setEditor(null)}
          save={async (input, commandId) => {
            const result =
              editor.kind === 'edit'
                ? await bound.update(editor.panel.id, { ...input, revision: editor.panel.revision })
                : await bound.create(input, commandId);
            remember(result);
            toast.success('Панель сохранена');
          }}
        />
      )}
      {share && (
        <Modal
          open
          title="Заменить ссылку доступа?"
          onOpenChange={(open) => {
            if (!open && !shareBusy) setShare(null);
          }}
          footer={
            <>
              <Button variant="secondary" disabled={shareBusy} onClick={() => setShare(null)}>
                Отмена
              </Button>
              <Button disabled={shareBusy} onClick={() => void rotate()}>
                Заменить ссылку
              </Button>
            </>
          }
        >
          <p>
            Старая ссылка перестанет работать. Новая будет показана один раз. После ошибки повтор
            сохраняет ту же операцию.
          </p>
          {shareError != null && <Failure error={shareError} />}
        </Modal>
      )}
    </>
  );
}
function CompanyActivity({ companyId }: { companyId: string }) {
  const connection = useQuery({
    queryKey: ['activity-control', companyId, 'connection'],
    queryFn: ({ signal }) => api.connection(signal),
    retry: false,
    staleTime: 0,
  });
  if (connection.isPending) return <p role="status">Проверка подключения Activity…</p>;
  if (connection.error)
    return <Failure error={connection.error} reload={() => void connection.refetch()} />;
  if (connection.data.state !== 'configured')
    return (
      <div className="space-y-3 rounded-xl border border-slate-200 p-6">
        <p>{connection.data.message}</p>
        <Button variant="secondary" onClick={() => void connection.refetch()}>
          Проверить подключение
        </Button>
      </div>
    );
  return (
    <ConnectedActivity
      key={`${companyId}:${connection.data.bindingId}`}
      scope={connection.data.scope}
      bindingId={connection.data.bindingId}
    />
  );
}
export function ActivityControlPage() {
  useTitle('Контроль активности | TeamOS');
  const company = useQuery({ queryKey: queryKeys.company, queryFn: authApi.getCompany });
  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <PageHeader
        title="Контроль активности"
        description="Общие настройки панелей Activity и виджета amoCRM"
      />
      <ProductNavigation />
      {company.data ? (
        <CompanyActivity key={company.data.id} companyId={company.data.id} />
      ) : company.error ? (
        <Failure error={company.error} />
      ) : (
        <p role="status">Загрузка компании…</p>
      )}
      <Link className="text-xs text-slate-500 underline" to="/legacy/ssd-activity">
        Устаревшая версия SSD (отдельные настройки)
      </Link>
    </div>
  );
}
