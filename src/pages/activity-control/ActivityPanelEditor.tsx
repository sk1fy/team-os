import { useEffect, useMemo, useState } from 'react';
import { Bell, BriefcaseBusiness, Clock3, Gauge, Search, Settings2, Users } from 'lucide-react';
import type {
  ActivityEmployee,
  ActivityOperator,
  ActivityPanel,
  ActivityPipeline,
  AmoId,
  TelegramStatusResult,
} from '@/api/rakurs/activity';
import {
  Avatar,
  Button,
  Checkbox,
  Input,
  Modal,
  MultiSelect,
  Select,
  Switch,
} from '@/components/ui';
import { cn } from '@/lib/cn';

const idOf = (value: AmoId) => String(value);
type OperatorDefaults = Pick<
  ActivityOperator,
  'enabled' | 'plan' | 'callDuration' | 'talkDuration' | 'overtime'
>;

const DEFAULT_OPERATOR: OperatorDefaults = {
  enabled: false,
  plan: 100,
  callDuration: 10,
  talkDuration: 30,
  overtime: 180,
};

const HOURS = Array.from({ length: 24 }, (_, hour) => {
  const value = `${String(hour).padStart(2, '0')}:00`;
  return { value, label: value };
});

function clonePanel(panel: ActivityPanel): ActivityPanel {
  return structuredClone(panel);
}

function employeeAvatar(avatar?: string) {
  if (!avatar) return undefined;
  if (/^https?:\/\//i.test(avatar)) return avatar;
  return `https://amo.amocrm.ru${avatar.startsWith('/') ? '' : '/'}${avatar}`;
}

export function GroupedEmployeeSelector({
  employees,
  values,
  onValuesChange,
  disabled,
}: {
  employees: ActivityEmployee[];
  values: AmoId[];
  onValuesChange: (values: AmoId[]) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState('');
  const selected = useMemo(() => new Set(values.map(idOf)), [values]);
  const knownIds = useMemo(
    () => new Set(employees.map((employee) => idOf(employee.id))),
    [employees],
  );
  const unknownValues = values.filter((value) => !knownIds.has(idOf(value)));
  const groups = useMemo(() => {
    const result = new Map<string, { name: string; employees: ActivityEmployee[] }>();
    for (const employee of employees) {
      const groupId = idOf(employee.groupId);
      const group = result.get(groupId) ?? {
        name: employee.groupName || 'Без отдела',
        employees: [],
      };
      group.employees.push(employee);
      result.set(groupId, group);
    }
    return [...result.entries()]
      .map(([id, group]) => ({
        id,
        name: group.name,
        employees: group.employees.sort((a, b) => a.name.localeCompare(b.name, 'ru')),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [employees]);

  const toggleEmployee = (employee: ActivityEmployee, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(idOf(employee.id));
    else next.delete(idOf(employee.id));
    onValuesChange([
      ...unknownValues,
      ...employees.filter((item) => next.has(idOf(item.id))).map((item) => item.id),
    ]);
  };

  const toggleGroup = (groupEmployees: ActivityEmployee[], checked: boolean) => {
    const next = new Set(selected);
    for (const employee of groupEmployees) {
      if (checked) next.add(idOf(employee.id));
      else next.delete(idOf(employee.id));
    }
    onValuesChange([
      ...unknownValues,
      ...employees.filter((item) => next.has(idOf(item.id))).map((item) => item.id),
    ]);
  };

  const query = search.trim().toLowerCase();
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      employees: query
        ? group.employees.filter((employee) => employee.name.toLowerCase().includes(query))
        : group.employees,
    }))
    .filter((group) => group.employees.length > 0);

  return (
    <div className={cn('rounded-lg border border-slate-200', disabled && 'opacity-60')}>
      <div className="border-b border-slate-100 p-3">
        <Input
          aria-label="Поиск сотрудника"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Начните вводить имя"
          disabled={disabled}
        />
      </div>
      <div className="max-h-80 overflow-y-auto p-2">
        {unknownValues.length > 0 && (
          <p className="mb-2 rounded-md bg-warning-50 px-3 py-2 text-xs text-warning-700">
            {unknownValues.length} выбранных сотрудников сейчас недоступны в amoCRM. Они будут
            сохранены.
          </p>
        )}
        {visibleGroups.map((group) => {
          const allSelected = group.employees.every((employee) => selected.has(idOf(employee.id)));
          return (
            <div key={group.id} className="mb-2 last:mb-0">
              <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                <span className="text-xs font-semibold text-slate-700">{group.name}</span>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>
                    {group.employees.filter((employee) => selected.has(idOf(employee.id))).length} /{' '}
                    {group.employees.length}
                  </span>
                  <Switch
                    checked={allSelected}
                    onCheckedChange={(checked) => toggleGroup(group.employees, checked)}
                    disabled={disabled}
                    aria-label={`Выбрать отдел ${group.name}`}
                  />
                </div>
              </div>
              {group.employees.map((employee) => (
                <label
                  key={idOf(employee.id)}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-slate-50"
                >
                  <Checkbox
                    checked={selected.has(idOf(employee.id))}
                    onCheckedChange={(checked) => toggleEmployee(employee, checked)}
                    disabled={disabled}
                    aria-label={`Выбрать ${employee.name}`}
                  />
                  <Avatar name={employee.name} src={employeeAvatar(employee.avatar)} size="xs" />
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                    {employee.name}
                  </span>
                </label>
              ))}
            </div>
          );
        })}
        {visibleGroups.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">
            {employees.length ? 'По вашему запросу ничего не найдено' : 'Сотрудники не найдены'}
          </p>
        )}
      </div>
    </div>
  );
}

type EditorSection = 'general' | 'employees' | 'calls' | 'telegram';

export function ActivityPanelEditor({
  open,
  panel,
  isNew,
  employees,
  pipelines,
  busy,
  onOpenChange,
  onSave,
  onConnectTelegram,
  onCheckTelegram,
}: {
  open: boolean;
  panel: ActivityPanel;
  isNew: boolean;
  employees: ActivityEmployee[];
  pipelines: ActivityPipeline[];
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (panel: ActivityPanel, close?: boolean) => Promise<void>;
  onConnectTelegram: (panel: ActivityPanel) => Promise<{ chatId: string; chatName: string }>;
  onCheckTelegram: (panel: ActivityPanel) => Promise<TelegramStatusResult>;
}) {
  const [section, setSection] = useState<EditorSection>('general');
  const [draft, setDraft] = useState(() => clonePanel(panel));
  const [error, setError] = useState('');
  const [telegramStatus, setTelegramStatus] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setDraft(clonePanel(panel));
    setSection('general');
    setError('');
    setTelegramStatus(undefined);
  }, [open, panel]);

  const employeeById = useMemo(
    () => new Map(employees.map((employee) => [idOf(employee.id), employee])),
    [employees],
  );

  const operatorById = useMemo(
    () => new Map(draft.operators.map((operator) => [idOf(operator.employeeId), operator])),
    [draft.operators],
  );

  const updateEmployees = (values: AmoId[]) => {
    const selected = new Set(values.map(idOf));
    const nextOperators = draft.operators.filter(
      (operator) =>
        selected.has(idOf(operator.employeeId)) || !employeeById.has(idOf(operator.employeeId)),
    );
    for (const employeeId of values) {
      if (!nextOperators.some((operator) => idOf(operator.employeeId) === idOf(employeeId))) {
        nextOperators.push({ employeeId, ...DEFAULT_OPERATOR });
      }
    }
    setDraft({ ...draft, employees: values, operators: nextOperators });
  };

  const updateOperator = (employeeId: AmoId, patch: Partial<OperatorDefaults>) => {
    const existing = operatorById.get(idOf(employeeId));
    const operator: ActivityOperator = {
      employeeId,
      ...DEFAULT_OPERATOR,
      ...existing,
      ...patch,
    };
    setDraft({
      ...draft,
      operators: [
        ...draft.operators.filter((item) => idOf(item.employeeId) !== idOf(employeeId)),
        operator,
      ],
    });
  };

  const validate = () => {
    if (!draft.panel_name.trim()) return 'Введите название панели';
    if (!draft.employees.length) return 'Выберите хотя бы одного сотрудника';
    if (draft.work_time_from >= draft.work_time_to) {
      return 'Начало рабочего дня должно быть раньше окончания';
    }
    if (draft.telegramInactivityMinutes < 10 || draft.telegramInactivityMinutes > 1440) {
      return 'Период неактивности должен быть от 10 до 1440 минут';
    }
    return '';
  };

  const save = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    try {
      await onSave({ ...draft, panel_name: draft.panel_name.trim() }, true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить панель');
    }
  };

  const connectTelegram = async () => {
    if (isNew) return;
    if (!draft.telegramToken.trim()) {
      setError('Введите токен Telegram-бота');
      return;
    }
    setError('');
    setTelegramStatus('Подключаем бота…');
    try {
      const result = await onConnectTelegram(draft);
      const updated = {
        ...draft,
        telegramChatId: result.chatId,
        telegramChatName: result.chatName,
      };
      setDraft(updated);
      setTelegramStatus(`Бот подключён: ${result.chatName || result.chatId}`);
      await onSave(updated, false);
    } catch (connectError) {
      setTelegramStatus(undefined);
      setError(connectError instanceof Error ? connectError.message : 'Не удалось подключить бота');
    }
  };

  const checkTelegram = async () => {
    setError('');
    setTelegramStatus('Проверяем связь…');
    try {
      const result = await onCheckTelegram(draft);
      if (result.alive) {
        setTelegramStatus(`Бот${result.bot_username ? ` @${result.bot_username}` : ''} на связи`);
      } else {
        const messages: Record<string, string> = {
          no_token: 'Сначала сохраните токен',
          invalid_token: 'Токен невалиден, проверьте его у @BotFather',
          network: 'Сервис Telegram недоступен',
          api_error: 'Не удалось проверить бота',
        };
        setTelegramStatus(undefined);
        setError(messages[result.error_code ?? ''] ?? 'Бот недоступен');
      }
    } catch (statusError) {
      setTelegramStatus(undefined);
      setError(statusError instanceof Error ? statusError.message : 'Не удалось проверить связь');
    }
  };

  const nav: Array<{ id: EditorSection; label: string; icon: typeof Settings2 }> = [
    { id: 'general', label: 'Общие', icon: Settings2 },
    { id: 'employees', label: 'Сотрудники', icon: Users },
    { id: 'calls', label: 'Звонки', icon: Gauge },
    { id: 'telegram', label: 'Telegram', icon: Bell },
  ];

  const selectedKnownEmployees = draft.employees
    .map((employeeId) => employeeById.get(idOf(employeeId)))
    .filter((employee): employee is ActivityEmployee => Boolean(employee));
  const groups = new Map<string, { name: string; employees: ActivityEmployee[] }>();
  for (const employee of selectedKnownEmployees) {
    const id = idOf(employee.groupId);
    const group = groups.get(id) ?? { name: employee.groupName, employees: [] };
    group.employees.push(employee);
    groups.set(id, group);
  }

  return (
    <Modal
      open={open}
      onOpenChange={(nextOpen) => !busy && onOpenChange(nextOpen)}
      title={isNew ? 'Создание новой панели' : 'Редактирование панели'}
      description="Настройки применятся после сохранения"
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Отмена
          </Button>
          <Button onClick={save} loading={busy}>
            {isNew ? 'Создать панель' : 'Сохранить'}
          </Button>
        </>
      }
    >
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700"
        >
          {error}
        </div>
      )}
      <div className="flex min-h-120 flex-col gap-5 md:flex-row">
        <nav
          className="flex shrink-0 gap-1 overflow-x-auto md:w-44 md:flex-col"
          aria-label="Разделы настройки панели"
        >
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              key={id}
              onClick={() => setSection(id)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
                section === id
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1 border-slate-100 md:border-l md:pl-6">
          {section === 'general' && (
            <div className="space-y-6">
              <SectionTitle
                icon={Settings2}
                title="Основные настройки"
                description="Задайте базовые параметры панели"
              />
              <Input
                label="Название панели"
                value={draft.panel_name}
                onChange={(event) => setDraft({ ...draft, panel_name: event.target.value })}
                placeholder="Моя компания"
                maxLength={100}
              />
              <div>
                <SectionTitle icon={Clock3} title="Рабочее время компании" />
                <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:max-w-sm">
                  <Select
                    aria-label="Начало рабочего дня"
                    options={HOURS}
                    value={draft.work_time_from}
                    onValueChange={(value) => setDraft({ ...draft, work_time_from: value })}
                  />
                  <span className="text-slate-400">—</span>
                  <Select
                    aria-label="Окончание рабочего дня"
                    options={HOURS}
                    value={draft.work_time_to}
                    onValueChange={(value) => setDraft({ ...draft, work_time_to: value })}
                  />
                </div>
              </div>
              <div>
                <SectionTitle
                  icon={BriefcaseBusiness}
                  title="Воронки"
                  description="Если ничего не выбрано, учитываются все воронки"
                />
                <MultiSelect
                  className="mt-3"
                  options={pipelines.map((pipeline) => ({
                    value: idOf(pipeline.value),
                    label: pipeline.label,
                  }))}
                  values={draft.pipelines.map(idOf)}
                  onValuesChange={(values) => setDraft({ ...draft, pipelines: values })}
                  placeholder="Все воронки"
                  formatCount={(count) => `Выбрано воронок: ${count}`}
                />
              </div>
            </div>
          )}

          {section === 'employees' && (
            <div className="space-y-4">
              <SectionTitle
                icon={Users}
                title="Сотрудники"
                description="Выберите, чью активность показывать на панели"
              />
              <GroupedEmployeeSelector
                employees={employees}
                values={draft.employees}
                onValuesChange={updateEmployees}
              />
              {selectedKnownEmployees.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full min-w-130 text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Сотрудник</th>
                        <th className="px-3 py-2 text-center">План/факт</th>
                        <th className="w-32 px-3 py-2">План</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedKnownEmployees.map((employee) => {
                        const operator = operatorById.get(idOf(employee.id)) ?? {
                          employeeId: employee.id,
                          ...DEFAULT_OPERATOR,
                        };
                        return (
                          <tr key={idOf(employee.id)}>
                            <td className="px-3 py-2 font-medium text-slate-700">
                              {employee.name}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Checkbox
                                checked={operator.enabled}
                                onCheckedChange={(checked) =>
                                  updateOperator(employee.id, { enabled: checked })
                                }
                                aria-label={`Включить план/факт для ${employee.name}`}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                type="number"
                                min={0}
                                value={operator.plan}
                                disabled={!operator.enabled}
                                onChange={(event) =>
                                  updateOperator(employee.id, {
                                    plan: Math.max(0, Number(event.target.value)),
                                  })
                                }
                                aria-label={`План для ${employee.name}`}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {section === 'calls' && (
            <div className="space-y-4">
              <SectionTitle
                icon={Gauge}
                title="Настройка по звонкам"
                description="Общие пороги применяются к выбранным сотрудникам отдела"
              />
              {groups.size === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
                  Сначала выберите сотрудников
                </p>
              ) : (
                [...groups.entries()].map(([groupId, group]) => {
                  const firstOperator = operatorById.get(idOf(group.employees[0]!.id));
                  const values = {
                    callDuration: firstOperator?.callDuration ?? 10,
                    talkDuration: firstOperator?.talkDuration ?? 30,
                    overtime: firstOperator?.overtime ?? 180,
                  };
                  const setForGroup = (
                    field: 'callDuration' | 'talkDuration' | 'overtime',
                    value: number,
                  ) => {
                    const employeeIds = new Set(
                      group.employees.map((employee) => idOf(employee.id)),
                    );
                    const nextOperators = draft.operators.map((operator) =>
                      employeeIds.has(idOf(operator.employeeId))
                        ? { ...operator, [field]: Math.max(0, value) }
                        : operator,
                    );
                    setDraft({ ...draft, operators: nextOperators });
                  };
                  return (
                    <section key={groupId} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-slate-900">{group.name}</h3>
                        <span className="text-xs text-slate-500">
                          Сотрудников: {group.employees.length}
                        </span>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <Input
                          label="Дозвон, с."
                          type="number"
                          min={0}
                          value={values.callDuration}
                          onChange={(event) =>
                            setForGroup('callDuration', Number(event.target.value))
                          }
                        />
                        <Input
                          label="Разговор, с."
                          type="number"
                          min={0}
                          value={values.talkDuration}
                          onChange={(event) =>
                            setForGroup('talkDuration', Number(event.target.value))
                          }
                        />
                        <Input
                          label="Превышение, с."
                          type="number"
                          min={0}
                          value={values.overtime}
                          onChange={(event) => setForGroup('overtime', Number(event.target.value))}
                        />
                      </div>
                    </section>
                  );
                })
              )}
            </div>
          )}

          {section === 'telegram' && (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <SectionTitle
                  icon={Bell}
                  title="Уведомления в Telegram"
                  description="Бот сообщит, если у сотрудника долго нет активности в amoCRM"
                />
                <Switch
                  checked={draft.telegramBotEnabled}
                  onCheckedChange={(checked) => setDraft({ ...draft, telegramBotEnabled: checked })}
                  aria-label="Включить уведомления в Telegram"
                />
              </div>
              <div className="rounded-md border border-warning-100 bg-warning-50 px-3 py-2 text-xs text-warning-700">
                Для уведомлений используйте отдельного бота без webhook. Из-за ограничений Telegram
                возможны задержки доставки.
              </div>
              <Input
                label="Токен бота"
                type="password"
                value={draft.telegramToken}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    telegramToken: event.target.value,
                    telegramChatId: '',
                    telegramChatName: '',
                  })
                }
                placeholder="Токен от @BotFather"
                disabled={!draft.telegramBotEnabled}
                autoComplete="off"
              />
              <Input
                label="Если нет активности дольше, минут"
                type="number"
                min={10}
                max={1440}
                value={draft.telegramInactivityMinutes}
                onChange={(event) =>
                  setDraft({ ...draft, telegramInactivityMinutes: Number(event.target.value) })
                }
                disabled={!draft.telegramBotEnabled}
                hint="Рекомендуем не меньше 15–20 минут"
              />
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-900">Подключение бота</p>
                <p className="mt-1 text-xs text-slate-500">
                  Получатель должен открыть бота, отправить ему /start, затем нажать «Подключить».
                </p>
                {telegramStatus && (
                  <p className="mt-2 text-sm font-medium text-success-700">{telegramStatus}</p>
                )}
                {draft.telegramChatId && !telegramStatus && (
                  <p className="mt-2 text-sm font-medium text-success-700">
                    Бот подключён: {draft.telegramChatName || draft.telegramChatId}
                  </p>
                )}
                {isNew && (
                  <p className="mt-2 text-xs text-warning-700">
                    Сначала создайте панель, затем подключите бота.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={connectTelegram}
                    loading={busy}
                    disabled={isNew || !draft.telegramBotEnabled || !draft.telegramToken}
                  >
                    {draft.telegramChatId ? 'Переподключить' : 'Подключить'}
                  </Button>
                  {draft.telegramChatId && (
                    <Button variant="ghost" size="sm" onClick={checkTelegram} loading={busy}>
                      Проверить связь
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Search;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
        <Icon className="size-4.5" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
    </div>
  );
}
