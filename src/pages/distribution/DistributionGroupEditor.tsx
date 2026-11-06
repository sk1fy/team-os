import { useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { queryKeys } from '@/api/queryKeys';
import {
  distributionRuntimeApi as api,
  type Group,
  type Rule,
  type Connection,
} from '@/api/distributionRuntime';
import { ApiError } from '@/api/client';
import { Button, Input, Switch, Select } from '@/components/ui';
import type { User } from '@/types';
import { cn } from '@/lib/cn';
import { fullName } from '@/lib/labels';
import { Failure } from './runtimeShared';
import { DistributionEmployeePicker } from './DistributionEmployeePicker';
import { cardClass, PersonAvatar, Pill, Problem, SectionTitle } from './ui';

/** Форма настроек группы: состав, порядок, запуск, режим. */
export function DistributionGroupEditor({
  group,
  rule,
  binding: initialBinding,
  connections,
  users,
  initialTimezone,
  manage,
  timezoneStatus,
}: {
  group?: Group;
  rule?: Rule;
  binding?: Connection;
  connections: Connection[];
  users: User[];
  initialTimezone?: string;
  manage: boolean;
  timezoneStatus?: 'confirmed' | 'cached' | 'unavailable';
}) {
  const headingId = useId();
  const binding = connections.find((c) => c.bindingId === initialBinding?.bindingId);
  const navigate = useNavigate();
  const client = useQueryClient();
  const [name, setName] = useState(group?.name ?? '');
  const [members, setMembers] = useState(group?.memberIds ?? []);
  const [disabled, setDisabled] = useState(group?.disabledMemberIds ?? []);
  const [pipeline, setPipeline] = useState(rule?.pipelineId ?? '');
  const [status, setStatus] = useState(rule?.statusId ?? '');
  const [source, setSource] = useState<'legacy_stage' | 'creation' | 'digital_pipeline'>(
    rule ? (rule.source ?? 'legacy_stage') : 'creation',
  );
  const [keep, setKeep] = useState(rule?.keepCurrentResponsible ?? true);
  const [active, setActive] = useState(!!rule?.active && !!group?.active);
  const [executionMode, setExecutionMode] = useState<'live' | 'observe' | ''>(
    rule?.executionMode === 'observe'
      ? 'observe'
      : rule?.executionMode === 'live'
        ? 'live'
        : rule
          ? ''
          : 'observe',
  );
  const [groupRevision, setGroupRevision] = useState(group?.revision);
  const [ruleRevision, setRuleRevision] = useState(rule?.revision);
  const [savedGroup, setSavedGroup] = useState<Group | undefined>(group);
  const [savedRule, setSavedRule] = useState<Rule | undefined>(rule);
  const modeSupported =
    !savedRule || savedRule.executionMode === 'live' || savedRule.executionMode === 'observe';
  const [message, setMessage] = useState('');
  const [creationUncertain, setCreationUncertain] = useState(false);
  const savedSteps = useRef<string[]>([]);
  const refs = useQuery({
    queryKey: queryKeys.distribution.runtime('references', binding?.bindingId),
    queryFn: ({ signal }) => api.references(binding!.bindingId, signal),
    enabled: !!binding,
    retry: 1,
  });
  const mappings = useQuery({
    queryKey: queryKeys.distribution.runtime('mappings', binding?.bindingId),
    queryFn: ({ signal }) => api.mappings(binding!.bindingId, signal),
    enabled: !!binding,
    retry: 1,
  });
  const effectiveTimezone =
    timezoneStatus === 'confirmed' || timezoneStatus === 'cached' ? initialTimezone : undefined;
  const unmapped = members.filter(
    (id) =>
      !disabled.includes(id) &&
      !mappings.data?.some(
        (m) =>
          m.userIdSnapshot === id &&
          m.state === 'verified' &&
          refs.data?.users.some((u) => u.id === m.crmUserId && u.isActive),
      ),
  );
  const submit = useMutation({
    mutationFn: async () => {
      savedSteps.current = [];
      if (!name.trim() || members.length === 0)
        throw new Error('Укажите название и добавьте сотрудников.');
      if (
        !binding ||
        (source !== 'digital_pipeline' && !pipeline) ||
        (source === 'legacy_stage' && !status)
      )
        throw new Error(
          source === 'digital_pipeline'
            ? 'Нет подтверждённого подключения amoCRM.'
            : source === 'creation'
              ? 'Выберите воронку.'
              : 'Выберите воронку и этап существующего правила.',
        );
      if (active && binding && binding.mappingRevision !== binding.mappingAckRevision)
        throw new Error('Сопоставления сотрудников ещё не подтверждены сервером amoCRM.');
      if (active && (unmapped.length > 0 || !mappings.isSuccess || !refs.isSuccess))
        throw new Error(
          'Перед запуском сопоставьте всех включённых сотрудников с активными пользователями amoCRM.',
        );
      if (active && !effectiveTimezone)
        throw new Error(
          'Часовой пояс аккаунта amoCRM не подтверждён. Повторите загрузку данных перед запуском.',
        );
      setMessage('');
      let target = savedGroup;
      if (!target) {
        if (creationUncertain)
          throw new Error(
            'Ответ на создание группы не получен. Откройте список групп и проверьте, создалась ли группа, прежде чем создавать новую.',
          );
        setCreationUncertain(true);
        try {
          target = await api.createGroup({
            name: name.trim(),
            description: '',
            memberIds: members,
          });
          setCreationUncertain(false);
        } catch (error) {
          if (error instanceof ApiError && error.status >= 400 && error.status < 500)
            setCreationUncertain(false);
          throw error;
        }
        savedSteps.current.push('группа создана');
        setSavedGroup(target);
        setGroupRevision(target.revision);
      }
      const expectedGroupRevision = groupRevision ?? target.revision;
      if (!expectedGroupRevision)
        throw new Error('Сервер не передал версию группы. Обновите данные перед сохранением.');
      const changed = await api.configureGroup(target.id, {
        expectedRevision: expectedGroupRevision,
        name: name.trim(),
        memberIds: members,
        disabledMemberIds: disabled.filter((id) => members.includes(id)),
        // Rule and group writes are separate transactions. Keep the group paused
        // until the intended mode and rule revision have been saved successfully.
        active: false,
        algorithm: 'round_robin',
      });
      savedSteps.current.push('состав и настройки группы (приостановлена)');
      setSavedGroup(changed);
      setGroupRevision(changed.revision);
      let nextRule: Rule;
      if (savedRule) {
        nextRule = await api.updateRule(savedRule.id, {
          expectedRevision: ruleRevision ?? savedRule.revision,
          ...(modeSupported && executionMode ? { executionMode } : {}),
          active,
          keepCurrentResponsible: keep,
          source,
          pipelineId: source === 'digital_pipeline' ? '' : pipeline,
          statusId: source === 'legacy_stage' ? status : '',
        });
      } else {
        nextRule = await api.createRule({
          executionMode: executionMode || 'observe',
          bindingId: binding.bindingId,
          bindingRevision: binding.revision,
          groupId: target.id,
          source,
          pipelineId: source === 'digital_pipeline' ? '' : pipeline,
          statusId: source === 'legacy_stage' ? status : '',
          active,
          keepCurrentResponsible: keep,
        });
      }
      setSavedRule(nextRule);
      setRuleRevision(nextRule.revision);
      savedSteps.current.push('правило распределения');
      if (active) {
        if (!changed.revision)
          throw new Error('Сервер не передал версию приостановленной группы. Обновите данные.');
        const enabled = await api.configureGroup(target.id, {
          expectedRevision: changed.revision,
          name: name.trim(),
          memberIds: members,
          disabledMemberIds: disabled.filter((id) => members.includes(id)),
          active: true,
          algorithm: 'round_robin',
        });
        setSavedGroup(enabled);
        setGroupRevision(enabled.revision);
        savedSteps.current.push('группа включена');
      }
      return target.id;
    },
    retry: false,
    onSuccess: (id) => {
      setMessage('Настройки сохранены');
      void client.invalidateQueries({ queryKey: queryKeys.distribution.all });
      if (!group) navigate(`/distribution/${id}`, { replace: true });
    },
    onError: (error) => {
      setMessage(
        error instanceof ApiError && error.status === 409
          ? 'Настройки изменились на сервере. Ваши поля сохранены. Загрузите новые версии и повторно проверьте изменения.'
          : `${error instanceof Error ? error.message : 'Не удалось сохранить'} Некоторые настройки могли сохраниться; проверьте данные перед повтором.`,
      );
      if (savedSteps.current.length)
        setMessage(
          (current) =>
            `${current} Уже сохранено: ${savedSteps.current.join(', ')}. Остальные изменения требуют проверки.`,
        );
      void client.invalidateQueries({ queryKey: queryKeys.distribution.all });
    },
  });
  const reloadVersions = async () => {
    const [gs, rs] = await Promise.all([api.groups(), api.rules()]);
    const current = gs.find((g) => g.id === savedGroup?.id);
    const currentRule = rs.items.find((r) => r.groupId === savedGroup?.id);
    if (current) {
      setGroupRevision(current.revision);
      setSavedGroup(current);
    }
    if (currentRule) {
      setRuleRevision(currentRule.revision);
      setSavedRule(currentRule);
    }
    setMessage('Версии обновлены. Ваши поля сохранены: проверьте их перед сохранением.');
  };
  const move = (id: string, delta: number) =>
    setMembers((current) => {
      const copy = [...current];
      const index = copy.indexOf(id);
      if (index + delta < 0 || index + delta >= copy.length) return current;
      [copy[index], copy[index + delta]] = [copy[index + delta]!, copy[index]!];
      return copy;
    });
  return (
    <form
      className={cardClass}
      aria-labelledby={headingId}
      onSubmit={(event) => {
        event.preventDefault();
        if (!submit.isPending) submit.mutate();
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0 flex-1 basis-64">
          <h2 id={headingId} className="text-[15px] font-semibold text-ink">
            Настройки распределения
          </h2>
          <p className="mt-1 text-[13px] text-slate-500">
            Состав, порядок, воронка и режим сохраняются вместе.
          </p>
        </div>
        {!manage && (
          <p role="status" className="flex items-center gap-2 text-[13px] text-slate-500">
            <Pill>Только просмотр</Pill>
            Настройки доступны только для просмотра.
          </p>
        )}
      </div>
      <fieldset disabled={!manage || submit.isPending} className="min-w-0">
        <div className="grid gap-x-8 gap-y-7 px-5 py-5 lg:grid-cols-2">
          <div className="min-w-0 space-y-5">
            <Input
              label="Название группы"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={200}
            />
            <fieldset className="space-y-2">
              <legend className="mb-2 text-xs font-semibold text-slate-700">
                Запуск распределения
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ['creation', 'При создании сделки в выбранной воронке'],
                    ['digital_pipeline', 'По триггеру на этапе'],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className={cn(
                      'flex cursor-pointer items-start gap-2.5 rounded-[10px] border p-3 text-sm transition-colors',
                      source === value
                        ? 'border-primary-600 bg-primary-50 text-ink dark:bg-primary-900'
                        : 'border-slate-200 text-slate-700 hover:border-slate-300 dark:text-slate-200',
                    )}
                  >
                    <input
                      type="radio"
                      name="distribution-source"
                      value={value}
                      checked={source === value}
                      onChange={() => {
                        setSource(value);
                        setStatus('');
                        if (value === 'digital_pipeline') setPipeline('');
                      }}
                      className="mt-0.5 accent-primary-600"
                    />
                    {label}
                  </label>
                ))}
              </div>
              {source === 'legacy_stage' && (
                <p className="text-xs text-slate-500">
                  Сохранено существующее правило. Выберите новый тип запуска для перехода.
                </p>
              )}
            </fieldset>
            {source === 'legacy_stage' && (
              <p className="text-[13px] text-slate-600 dark:text-slate-300">
                Существующее правило срабатывает по обычному вебхуку на выбранном этапе. Режимы
                «создание сделки» и «триггер Digital Pipeline» — отдельные, выберите один из них,
                чтобы перевести правило на новый источник запуска.
              </p>
            )}
            {source === 'digital_pipeline' && (
              <p className="text-[13px] text-slate-600 dark:text-slate-300">
                Добавьте триггер этой группы на нужный этап в Digital Pipeline amoCRM. Место запуска
                настраивается в amoCRM.
              </p>
            )}
            {source !== 'digital_pipeline' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Воронка"
                  placeholder="Выберите воронку"
                  value={pipeline}
                  onValueChange={(value) => {
                    setPipeline(value);
                    setStatus('');
                  }}
                  disabled={!manage || submit.isPending}
                  options={
                    refs.data
                      ? refs.data.pipelines.map((p) => ({ value: p.id, label: p.name }))
                      : pipeline
                        ? [{ value: pipeline, label: `Воронка ${pipeline}` }]
                        : []
                  }
                />
                {source === 'legacy_stage' && (
                  <Select
                    label="Этап"
                    placeholder="Выберите этап"
                    value={status}
                    onValueChange={setStatus}
                    disabled={!manage || submit.isPending || !pipeline}
                    options={
                      refs.data
                        ? (refs.data.pipelines.find((p) => p.id === pipeline)?.statuses ?? []).map(
                            (s) => ({ value: s.id, label: s.name }),
                          )
                        : status
                          ? [{ value: status, label: `Этап ${status}` }]
                          : []
                    }
                  />
                )}
              </div>
            )}
            <p className="text-xs text-slate-500">
              {effectiveTimezone
                ? `Время аккаунта amoCRM: ${effectiveTimezone}.${timezoneStatus === 'cached' ? ' Используется последний подтверждённый часовой пояс; обновление временно недоступно.' : ''}`
                : 'Часовой пояс аккаунта amoCRM пока не подтверждён. Запуск недоступен до проверки подключения.'}
            </p>
            <div className="space-y-2 border-t border-slate-100 pt-5">
              <Select
                label="Режим правила"
                placeholder="Режим требует совместимого сервера"
                disabled={!manage || submit.isPending || !modeSupported}
                value={executionMode}
                onValueChange={(value) => setExecutionMode(value as 'live' | 'observe')}
                options={[
                  { value: 'observe', label: 'Наблюдение — без назначений' },
                  { value: 'live', label: 'Рабочий — назначение в amoCRM' },
                ]}
              />
              <p className="text-xs text-slate-500">
                Наблюдение сохраняет предложения без назначения. При сохранении группа
                приостанавливается и возобновляется только после успешной записи настроек.
              </p>
            </div>
            <div className="space-y-4 rounded-[10px] bg-surface-muted p-4">
              <Switch
                checked={keep}
                onCheckedChange={setKeep}
                label="Оставлять сделку у текущего ответственного, если он доступен"
                aria-label="Оставлять сделку у текущего ответственного, если он доступен"
              />
              <Switch
                checked={active}
                onCheckedChange={setActive}
                label="Распределение включено"
                aria-label="Распределение включено"
                description="Состояние изменится после сохранения настроек."
              />
            </div>
          </div>
          <div className="min-w-0">
            <SectionTitle>Сотрудники и порядок очереди</SectionTitle>
            <p className="mt-1.5 text-xs text-slate-500">
              Сделки распределяются по кругу в указанном порядке между доступными сотрудниками.
            </p>
            {members.length === 0 ? (
              <p className="mt-3 rounded-[10px] border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                Добавьте сотрудников, которые будут получать сделки.
              </p>
            ) : (
              <ul className="mt-3 rounded-[10px] border border-slate-200 px-3.5">
                {members.map((id, index) => {
                  const employee = users.find((u) => u.id === id);
                  const label = employee ? fullName(employee) : id;
                  const participates = !disabled.includes(id);
                  return (
                    <li
                      key={id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-100 py-2.5 last:border-b-0"
                    >
                      <span className="w-4 shrink-0 text-right text-xs font-semibold text-slate-500 tabular-nums">
                        {index + 1}
                      </span>
                      <PersonAvatar
                        name={employee ? fullName(employee) : 'Удалённый сотрудник'}
                        seed={id}
                        size="xs"
                        className={cn(!participates && 'opacity-50')}
                      />
                      <span className="min-w-0 flex-1 basis-36 text-sm break-words">
                        <span
                          className={cn(
                            'font-medium',
                            participates ? 'text-ink' : 'text-slate-500',
                          )}
                        >
                          {employee ? fullName(employee) : 'Удалённый сотрудник'}
                        </span>
                        {!participates && (
                          <span className="block text-xs text-slate-500">Не участвует</span>
                        )}
                        {unmapped.includes(id) && (
                          <span className="block text-xs text-warning-700 dark:text-amber-300">
                            Нет подтверждённой связи с активным пользователем amoCRM
                          </span>
                        )}
                      </span>
                      <span className="ml-auto flex shrink-0 items-center gap-1">
                        <Switch
                          checked={participates}
                          aria-label={`Участие ${label}`}
                          onCheckedChange={(checked) =>
                            setDisabled((current) =>
                              checked ? current.filter((value) => value !== id) : [...current, id],
                            )
                          }
                          className="mr-1"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="w-8 px-0"
                          disabled={index === 0}
                          aria-label={`Поднять ${label}`}
                          onClick={() => move(id, -1)}
                        >
                          <ChevronUp className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="w-8 px-0"
                          disabled={index === members.length - 1}
                          aria-label={`Опустить ${label}`}
                          onClick={() => move(id, 1)}
                        >
                          <ChevronDown className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="w-8 px-0"
                          aria-label={`Убрать ${label}`}
                          onClick={() =>
                            setMembers((current) => current.filter((value) => value !== id))
                          }
                        >
                          <X className="size-4" aria-hidden="true" />
                        </Button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <DistributionEmployeePicker
              users={users.filter((u) => !members.includes(u.id))}
              disabled={!manage || submit.isPending}
              onAdd={(id) =>
                setMembers((current) => (current.includes(id) ? current : [...current, id]))
              }
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-b-xl border-t border-slate-200 bg-surface-muted px-5 py-3.5">
          <Button
            type="submit"
            loading={submit.isPending}
            disabled={!binding || (!refs.isSuccess && (active || !savedRule))}
          >
            Сохранить настройки
          </Button>
          {!binding && (
            <p role="status" className="text-sm text-warning-700 dark:text-amber-300">
              Нет активного подключения amoCRM.
            </p>
          )}
        </div>
      </fieldset>
      {(refs.isError || mappings.isError || message || (submit.isError && manage)) && (
        <div className="space-y-3 border-t border-slate-200 px-5 py-4">
          {refs.isError && <Failure error={refs.error} retry={() => void refs.refetch()} />}
          {mappings.isError && (
            <Failure error={mappings.error} retry={() => void mappings.refetch()} />
          )}
          {message &&
            (submit.isError ? (
              <Problem role="status">{message}</Problem>
            ) : (
              <p role="status" className="text-sm text-ink">
                {message}
              </p>
            ))}
          {submit.isError && manage && (
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                void reloadVersions().catch(() =>
                  setMessage('Не удалось обновить версии. Попробуйте позже.'),
                )
              }
            >
              Загрузить новые версии
            </Button>
          )}
        </div>
      )}
    </form>
  );
}
