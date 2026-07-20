import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import {
  Bot,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Monitor,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { authApi } from '@/api';
import { queryKeys } from '@/api/queryKeys';
import {
  activityApi,
  createActivityPanel,
  type ActivityPanel,
  type ActivitySettings,
  type ActivityTaskSettings,
} from '@/api/rakurs/activity';
import type { RakursContext } from '@/api/rakurs/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { Avatar, Button, Input, Modal, Switch, Tabs } from '@/components/ui';
import { toast } from '@/stores/toast';
import { ActivityPanelEditor, GroupedEmployeeSelector } from './ActivityPanelEditor';

const idOf = (value: string | number) => String(value);

function panelLink(panel: ActivityPanel, baseLink: string) {
  return panel.activePanelLink || (baseLink ? `${baseLink}?id=${panel.id}` : '');
}

function PageSkeleton() {
  return (
    <div
      className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6"
      aria-label="Загрузка контроля активности"
    >
      <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
      <div className="h-10 w-72 animate-pulse rounded-lg bg-slate-100" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}

function PanelList({
  panels,
  baseLink,
  employees,
  busy,
  onCreate,
  onEdit,
  onDelete,
}: {
  panels: ActivityPanel[];
  baseLink: string;
  employees: Awaited<ReturnType<typeof activityApi.getEmployees>>;
  busy: boolean;
  onCreate: () => void;
  onEdit: (panel: ActivityPanel) => void;
  onDelete: (panel: ActivityPanel) => void;
}) {
  const [search, setSearch] = useState('');
  const employeeById = useMemo(
    () => new Map(employees.map((employee) => [idOf(employee.id), employee])),
    [employees],
  );
  const filteredPanels = panels.filter((panel) =>
    panel.panel_name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const copyLink = async (link: string) => {
    if (!link) {
      toast.error('Ссылка пока недоступна');
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Ссылка скопирована');
    } catch {
      toast.error('Не удалось скопировать ссылку', 'Выделите и скопируйте её вручную.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-primary-100 bg-primary-50/60 px-4 py-3 text-sm text-primary-800">
        Создайте панель, настройте сотрудников и откройте её по ссылке на отдельном мониторе или
        рабочем столе amoCRM.
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button onClick={onCreate} disabled={busy}>
          <Plus className="size-4" />
          Новая панель
        </Button>
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            aria-label="Поиск панелей"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по названию"
            className="[&_input]:pl-9"
          />
        </div>
      </div>

      {filteredPanels.length === 0 ? (
        <EmptyState
          icon={Monitor}
          title={panels.length ? 'Панели не найдены' : 'Пока нет созданных панелей'}
          description={
            panels.length
              ? 'Измените поисковый запрос.'
              : 'Создайте первую панель контроля активности.'
          }
          action={
            !panels.length ? (
              <Button size="sm" onClick={onCreate}>
                Создать панель
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredPanels.map((panel) => {
            const link = panelLink(panel, baseLink);
            const knownEmployees = panel.employees
              .map((employeeId) => employeeById.get(idOf(employeeId)))
              .filter((employee) => Boolean(employee));
            return (
              <article
                key={panel.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-surface shadow-card"
              >
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-slate-900">
                      {panel.panel_name || 'Без названия'}
                    </h2>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock3 className="size-3.5" />
                      {panel.work_time_from}–{panel.work_time_to}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(panel)}
                      disabled={busy}
                      aria-label={`Настроить панель ${panel.panel_name}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(panel)}
                      disabled={busy}
                      className="text-danger-600 hover:bg-danger-50 hover:text-danger-700"
                      aria-label={`Удалить панель ${panel.panel_name}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-4 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex -space-x-2">
                      {knownEmployees.slice(0, 4).map((employee) => (
                        <Avatar
                          key={idOf(employee!.id)}
                          name={employee!.name}
                          src={employee!.avatar}
                          size="sm"
                          className="ring-2 ring-surface"
                        />
                      ))}
                      {knownEmployees.length > 4 && (
                        <span className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 ring-2 ring-surface">
                          +{knownEmployees.length - 4}
                        </span>
                      )}
                    </div>
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Users className="size-3.5" />
                      {panel.employees.length}
                    </span>
                  </div>
                  <div className="flex min-w-0 items-center gap-2 rounded-md bg-slate-50 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-600" title={link}>
                      {link || 'Ссылка недоступна'}
                    </span>
                    {link && (
                      <>
                        <button
                          type="button"
                          onClick={() => copyLink(link)}
                          className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-primary-600"
                          aria-label="Скопировать ссылку"
                        >
                          <Copy className="size-4" />
                        </button>
                        <a
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-primary-600"
                          aria-label="Открыть панель"
                        >
                          <ExternalLink className="size-4" />
                        </a>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                      {panel.pipelines.length
                        ? `Воронок: ${panel.pipelines.length}`
                        : 'Все воронки'}
                    </span>
                    {panel.telegramBotEnabled && (
                      <span className="flex items-center gap-1 rounded-full bg-success-50 px-2 py-1 text-success-700">
                        <Bot className="size-3" /> Telegram
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TaskSettings({
  value,
  initialValue,
  employees,
  busy,
  onChange,
  onSave,
}: {
  value: ActivityTaskSettings;
  initialValue: ActivityTaskSettings;
  employees: Awaited<ReturnType<typeof activityApi.getEmployees>>;
  busy: boolean;
  onChange: (value: ActivityTaskSettings) => void;
  onSave: () => void;
}) {
  const dirty = JSON.stringify(value) !== JSON.stringify(initialValue);
  const priorities = [
    ['Срочные', 'Сегодня, задано время, дедлайн прошёл или наступит в ближайшие 10 минут.'],
    ['Просроченные', 'Задача уже просрочена и у неё задано конкретное время.'],
    ['Просроченные без времени', 'Задача просрочена, время выполнения не задано.'],
    ['Сегодняшние без времени', 'Задача назначена на сегодня как задача на весь день.'],
    ['На сегодня по времени', 'Сегодняшняя задача, до которой осталось больше 10 минут.'],
    ...(value.consider_future_tasks
      ? [['Будущие', 'Срок выполнения — завтра или позднее, со временем или без.']]
      : []),
  ];

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-sm leading-6 text-slate-600">
        Управляйте доступом к панели задач и правилами построения очереди. Изменения применятся
        только после сохранения.
      </p>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(20rem,0.8fr)_minmax(26rem,1.2fr)]">
        <section className="rounded-xl border border-slate-200 bg-surface shadow-card">
          <header className="flex items-start justify-between gap-4 border-b border-slate-100 p-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Панель задач</h2>
              <p className="mt-1 text-xs text-slate-500">Показывать только выбранным сотрудникам</p>
            </div>
            <Switch
              checked={value.task_panel_enabled}
              onCheckedChange={(checked) => onChange({ ...value, task_panel_enabled: checked })}
              aria-label="Включить панель задач"
            />
          </header>
          <div className="p-4">
            <GroupedEmployeeSelector
              employees={employees}
              values={value.enabled_employees}
              onValuesChange={(values) => onChange({ ...value, enabled_employees: values })}
              disabled={!value.task_panel_enabled}
            />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-surface shadow-card">
          <header className="border-b border-slate-100 p-4">
            <h2 className="text-base font-semibold text-slate-900">Настройки очереди</h2>
          </header>
          <div className="space-y-5 p-4">
            <div className="space-y-3">
              <Switch
                checked={value.consider_future_tasks}
                onCheckedChange={(checked) =>
                  onChange({ ...value, consider_future_tasks: checked })
                }
                disabled={!value.task_panel_enabled}
                label="Учитывать будущие задачи"
              />
              <Switch
                checked={value.include_related_deals}
                onCheckedChange={(checked) =>
                  onChange({ ...value, include_related_deals: checked })
                }
                disabled={!value.task_panel_enabled}
                label="Включить связанные сделки"
              />
            </div>
            <div className="border-t border-slate-100 pt-5">
              <h3 className="text-sm font-semibold text-slate-900">Приоритеты задач</h3>
              <ol className="mt-3 space-y-2">
                {priorities.map(([title, description], index) => (
                  <li key={title} className="flex gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{title}</p>
                      <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      </div>
      <div className="flex items-center justify-end gap-3">
        {dirty && (
          <span className="text-xs font-medium text-warning-700">Есть несохранённые изменения</span>
        )}
        <Button onClick={onSave} loading={busy} disabled={!dirty}>
          Сохранить настройки
        </Button>
      </div>
    </div>
  );
}

export function ActivityControlPage() {
  useTitle('Контроль активности — TeamOS');
  const queryClient = useQueryClient();
  const companyQuery = useQuery({ queryKey: queryKeys.company, queryFn: authApi.getCompany });
  const accountId = companyQuery.data?.amoAccountId?.trim() ?? '';
  const context = useMemo<RakursContext | null>(
    () => (accountId ? { accountId, appName: 'rkrs_activity' } : null),
    [accountId],
  );

  const settingsQuery = useQuery({
    queryKey: queryKeys.activity.settings(accountId),
    queryFn: ({ signal }) => activityApi.getSettings(context!, signal),
    enabled: Boolean(context),
  });
  const employeesQuery = useQuery({
    queryKey: queryKeys.activity.employees(accountId),
    queryFn: ({ signal }) => activityApi.getEmployees(context!, signal),
    enabled: Boolean(context),
  });
  const pipelinesQuery = useQuery({
    queryKey: queryKeys.activity.pipelines(accountId),
    queryFn: ({ signal }) => activityApi.getPipelines(context!, signal),
    enabled: Boolean(context),
  });
  const linkQuery = useQuery({
    queryKey: queryKeys.activity.link(accountId),
    queryFn: ({ signal }) => activityApi.getLink(context!, signal),
    enabled: Boolean(context),
  });

  const [editor, setEditor] = useState<{ panel: ActivityPanel; isNew: boolean } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ActivityPanel | null>(null);
  const [taskDraft, setTaskDraft] = useState<ActivityTaskSettings | null>(null);

  useEffect(() => {
    if (settingsQuery.data) {
      setTaskDraft((current) => current ?? structuredClone(settingsQuery.data.tasks));
    }
  }, [settingsQuery.data]);

  const persistMutation = useMutation({
    mutationFn: (settings: ActivitySettings) => activityApi.updateSettings(context!, settings),
    onSuccess: (settings) => {
      queryClient.setQueryData(queryKeys.activity.settings(accountId), settings);
    },
  });

  const currentSettings = () =>
    queryClient.getQueryData<ActivitySettings>(queryKeys.activity.settings(accountId)) ??
    settingsQuery.data;

  const persistPanel = async (panel: ActivityPanel, successToast?: string) => {
    const current = currentSettings();
    if (!current) throw new Error('Настройки ещё не загружены');
    const exists = current.panels.some((item) => item.id === panel.id);
    const panels = exists
      ? current.panels.map((item) => (item.id === panel.id ? panel : item))
      : [...current.panels, panel];
    await persistMutation.mutateAsync({ ...current, panels });
    if (successToast) toast.success(successToast);
  };

  const savePanel = async (panel: ActivityPanel, close = true) => {
    const isNew = !currentSettings()?.panels.some((item) => item.id === panel.id);
    await persistPanel(panel, isNew ? 'Панель создана' : 'Панель сохранена');
    if (close) setEditor(null);
  };

  const connectTelegram = async (panel: ActivityPanel) => {
    await persistPanel(panel);
    const result = await activityApi.discoverChatId(context!, panel.id);
    if (!result.ok || result.chat_id === undefined) {
      throw new Error(result.message || 'Не удалось подключить Telegram-бота');
    }
    return { chatId: String(result.chat_id), chatName: result.chat_name ?? '' };
  };

  const checkTelegram = (panel: ActivityPanel) => activityApi.getBotStatus(context!, panel.id);

  const deletePanel = async () => {
    const target = deleteTarget;
    const current = currentSettings();
    if (!target || !current) return;
    try {
      await persistMutation.mutateAsync({
        ...current,
        panels: current.panels.filter((panel) => panel.id !== target.id),
      });
      setDeleteTarget(null);
      toast.success('Панель удалена');
    } catch (error) {
      toast.error('Не удалось удалить панель', error instanceof Error ? error.message : undefined);
    }
  };

  const saveTasks = async () => {
    const current = currentSettings();
    if (!current || !taskDraft) return;
    try {
      await persistMutation.mutateAsync({ ...current, tasks: taskDraft });
      toast.success('Настройки панели задач сохранены');
    } catch (error) {
      toast.error(
        'Не удалось сохранить настройки',
        error instanceof Error ? error.message : undefined,
      );
    }
  };

  if (companyQuery.isPending) return <PageSkeleton />;
  if (companyQuery.isError) {
    return (
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <ErrorState
          title="Не удалось загрузить компанию"
          description="Без данных компании невозможно определить аккаунт amoCRM."
          onRetry={() => companyQuery.refetch()}
        />
      </div>
    );
  }

  if (!accountId) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <PageHeader
          title="Контроль активности"
          description="Дашборды активности сотрудников и очередь задач"
        />
        <EmptyState
          icon={Settings2}
          title="Не указан Account ID amoCRM"
          description="Добавьте идентификатор аккаунта amoCRM в настройках компании, чтобы загрузить данные Rakurs."
          action={
            <Link
              to="/settings"
              className="inline-flex h-8 items-center rounded-md bg-primary-600 px-3 text-[13px] font-semibold text-white hover:bg-primary-700"
            >
              Перейти в настройки
            </Link>
          }
        />
      </div>
    );
  }

  if (settingsQuery.isPending) return <PageSkeleton />;
  if (settingsQuery.isError || !settingsQuery.data) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <PageHeader title="Контроль активности" />
        <ErrorState
          title="Не удалось загрузить настройки активности"
          description={
            settingsQuery.error instanceof Error ? settingsQuery.error.message : undefined
          }
          onRetry={() => settingsQuery.refetch()}
        />
      </div>
    );
  }

  const employees = employeesQuery.data ?? [];
  const pipelines = pipelinesQuery.data ?? [];
  const settings = settingsQuery.data;
  const busy = persistMutation.isPending;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Контроль активности"
        description="Настройте дашборды активности сотрудников и доступ к панели задач"
        actions={
          <div className="flex items-center gap-2 rounded-full bg-success-50 px-3 py-1.5 text-xs font-medium text-success-700">
            <CheckCircle2 className="size-3.5" />
            amoCRM подключена
          </div>
        }
      />

      {(employeesQuery.isError || pipelinesQuery.isError || linkQuery.isError) && (
        <div className="rounded-md border border-warning-100 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          Часть справочников amoCRM не загрузилась. Можно продолжить работу, но некоторые списки
          будут неполными.
          <button
            type="button"
            className="ml-2 font-semibold underline underline-offset-2"
            onClick={() => {
              employeesQuery.refetch();
              pipelinesQuery.refetch();
              linkQuery.refetch();
            }}
          >
            Повторить
          </button>
        </div>
      )}

      <Tabs
        items={[
          {
            value: 'panels',
            label: 'Дашборды',
            content: (
              <PanelList
                panels={settings.panels}
                baseLink={linkQuery.data ?? ''}
                employees={employees}
                busy={busy}
                onCreate={() =>
                  setEditor({ panel: createActivityPanel(linkQuery.data ?? ''), isNew: true })
                }
                onEdit={(panel) => setEditor({ panel, isNew: false })}
                onDelete={setDeleteTarget}
              />
            ),
          },
          {
            value: 'tasks',
            label: 'Панель задач',
            content: taskDraft ? (
              <TaskSettings
                value={taskDraft}
                initialValue={settings.tasks}
                employees={employees}
                busy={busy}
                onChange={setTaskDraft}
                onSave={saveTasks}
              />
            ) : null,
          },
        ]}
      />

      {editor && (
        <ActivityPanelEditor
          open
          panel={editor.panel}
          isNew={editor.isNew}
          employees={employees}
          pipelines={pipelines}
          busy={busy}
          onOpenChange={(open) => !open && setEditor(null)}
          onSave={savePanel}
          onConnectTelegram={connectTelegram}
          onCheckTelegram={checkTelegram}
        />
      )}

      <Modal
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && !busy && setDeleteTarget(null)}
        title="Удалить панель?"
        description={`Панель «${deleteTarget?.panel_name ?? ''}» и её ссылка перестанут быть доступны.`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={busy}>
              Отмена
            </Button>
            <Button variant="danger" onClick={deletePanel} loading={busy}>
              Удалить
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Это действие нельзя отменить.</p>
      </Modal>
    </div>
  );
}

export default ActivityControlPage;
