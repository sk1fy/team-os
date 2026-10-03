import { useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { httpAuthApi as authApi, httpOrgApi as orgApi } from '@/api/http';
import { queryKeys } from '@/api/queryKeys';
import {
  distributionRuntimeApi as api,
  type Group,
  type Rule,
  type Connection,
} from '@/api/distributionRuntime';
import { ApiError } from '@/api/client';
import { Button, Input, Badge } from '@/components/ui';
import type { User } from '@/types';
import { fullName } from '@/lib/labels';
import { Failure, panelClass, useVisiblePolling, reasonText, dateText } from './runtimeShared';
import { DistributionQueue } from './DistributionQueue';
export function DistributionGroupPage() {
  const { groupId } = useParams();
  const create = groupId === 'new';
  const [settingsOpen, setSettingsOpen] = useState(create);
  const poll = useVisiblePolling();
  const groups = useQuery({
    queryKey: queryKeys.distribution.groups,
    queryFn: ({ signal }) => api.groups(signal),
    ...poll,
  });
  const rules = useQuery({
    queryKey: queryKeys.distribution.runtime('rules'),
    queryFn: ({ signal }) => api.rules(0, signal),
    ...poll,
  });
  const connections = useQuery({
    queryKey: queryKeys.distribution.runtime('connections'),
    queryFn: ({ signal }) => api.connections(signal),
    ...poll,
  });
  const users = useQuery({
    queryKey: queryKeys.distribution.runtime('users'),
    queryFn: orgApi.getUsers,
  });
  const actor = useQuery({
    queryKey: queryKeys.distribution.runtime('actor'),
    queryFn: authApi.getCurrentUser,
  });
  const settings = useQuery({
    queryKey: queryKeys.distribution.runtime('settings'),
    queryFn: ({ signal }) => api.settings(signal),
    retry: 1,
  });
  const group = groups.data?.find((g) => g.id === groupId);
  const rule =
    rules.data?.items.find((r) => r.groupId === groupId && r.active) ??
    rules.data?.items.find((r) => r.groupId === groupId);
  const binding =
    connections.data?.find((c) => c.bindingId === rule?.bindingId) ??
    connections.data?.find((c) => c.state === 'active');
  const availability = useQuery({
    queryKey: queryKeys.distribution.runtime('availability', rule?.id),
    queryFn: ({ signal }) => api.availability(rule!.id, signal),
    enabled: !!rule,
    ...poll,
  });
  const error = groups.error ?? rules.error ?? connections.error ?? users.error;
  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <Link to="/distribution" className="text-sm font-semibold text-primary-700">
        ← Все группы
      </Link>
      {error ? (
        <Failure
          error={error}
          retry={() => {
            void groups.refetch();
            void rules.refetch();
            void connections.refetch();
            void users.refetch();
          }}
        />
      ) : null}
      {groups.isPending || rules.isPending || connections.isPending || users.isPending ? (
        <p role="status">Загружаем настройки…</p>
      ) : !groups.data || !rules.data || !connections.data || !users.data ? null : !create &&
        !group ? (
        <p role="alert">Группа не найдена</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold">{create ? 'Новая группа' : group?.name}</h1>
            {!create && (
              <div className="flex gap-2">
                <Button
                  variant={settingsOpen ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={() => setSettingsOpen(false)}
                >
                  Очередь группы
                </Button>
                <Button
                  variant={settingsOpen ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setSettingsOpen(true)}
                >
                  Настройки
                </Button>
              </div>
            )}
          </div>
          <div hidden={!settingsOpen}>
            {(rules.data?.items.filter((r) => r.groupId === groupId).length ?? 0) > 1 ? (
              <div role="alert" className={panelClass}>
                <p>
                  Для группы сохранено несколько правил. Требуется проверка конфигурации
                  администратором; редактор временно недоступен.
                </p>
                <ul className="mt-3 space-y-2">
                  {rules.data?.items
                    .filter((r) => r.groupId === groupId)
                    .map((r) => (
                      <li key={r.id} className="break-all text-xs">
                        {r.id}: {r.active ? 'включено' : 'приостановлено'} · воронка {r.pipelineId},
                        этап {r.statusId}
                      </li>
                    ))}
                </ul>
              </div>
            ) : (
              <Editor
                key={groupId}
                group={group}
                rule={rule}
                binding={binding}
                connections={connections.data ?? []}
                users={users.data ?? []}
                initialTimezone={settings.data?.timezone}
                manage={actor.data?.role === 'owner' || actor.data?.role === 'admin'}
                settingsLoaded={settings.isSuccess}
              />
            )}
          </div>
          {settings.isError && (
            <Failure error={settings.error} retry={() => void settings.refetch()} />
          )}
          {!settingsOpen && rule && (
            <section className={panelClass}>
              <h2 className="text-lg font-semibold">Доступность по графику</h2>
              <p className="mt-1 text-sm text-slate-500">
                Рабочая нагрузка не рассчитывается: источник этой метрики пока не подключён.
              </p>
              {availability.isError ? (
                <Failure error={availability.error} retry={() => void availability.refetch()} />
              ) : availability.isPending ? (
                <p role="status">Проверяем расписания…</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {availability.data?.employees.map((e) => (
                    <li
                      key={e.employeeId}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3"
                    >
                      <div>
                        <p className="font-medium">
                          {fullName(
                            users.data?.find((u) => u.id === e.employeeId) ??
                              ({ firstName: 'Сотрудник', lastName: e.employeeId } as User),
                          )}
                        </p>
                        <p className="text-xs text-slate-500">
                          {e.available
                            ? `Доступен до ${dateText(e.until, settings.data?.timezone)}`
                            : `Следующая смена: ${dateText(e.nextShift, settings.data?.timezone)}`}
                        </p>
                      </div>
                      <Badge variant={e.available ? 'success' : 'neutral'}>
                        {e.available ? 'Доступен' : reasonText(e.reason)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {!create && !settingsOpen && (
            <DistributionQueue groupId={groupId} groups={groups.data ?? []} />
          )}
        </>
      )}
    </div>
  );
}
function Editor({
  group,
  rule,
  binding: initialBinding,
  connections,
  users,
  initialTimezone,
  manage,
  settingsLoaded,
}: {
  group?: Group;
  rule?: Rule;
  binding?: Connection;
  connections: Connection[];
  users: User[];
  initialTimezone?: string;
  manage: boolean;
  settingsLoaded: boolean;
}) {
  const [selectedBinding, setSelectedBinding] = useState(initialBinding?.bindingId ?? '');
  const binding = connections.find((c) => c.bindingId === selectedBinding);
  const navigate = useNavigate();
  const client = useQueryClient();
  const [name, setName] = useState(group?.name ?? '');
  const [members, setMembers] = useState(group?.memberIds ?? []);
  const [disabled, setDisabled] = useState(group?.disabledMemberIds ?? []);
  const [pipeline, setPipeline] = useState(rule?.pipelineId ?? '');
  const [status, setStatus] = useState(rule?.statusId ?? '');
  const [keep, setKeep] = useState(rule?.keepCurrentResponsible ?? true);
  const [active, setActive] = useState(rule?.active ?? false);
  const [timezone, setTimezone] = useState(initialTimezone ?? '');
  const [groupRevision, setGroupRevision] = useState(group?.revision);
  const [ruleRevision, setRuleRevision] = useState(rule?.revision);
  const [savedGroup, setSavedGroup] = useState<Group | undefined>(group);
  const [savedRule, setSavedRule] = useState<Rule | undefined>(rule);
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
  const [timezoneTouched, setTimezoneTouched] = useState(false);
  const effectiveTimezone = timezoneTouched ? timezone : timezone || initialTimezone || '';
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
      if (!pipeline || !status || !binding)
        throw new Error('Выберите подключение, воронку и этап.');
      if (active && binding && binding.mappingRevision !== binding.mappingAckRevision)
        throw new Error('Сопоставления сотрудников ещё не подтверждены сервером amoCRM.');
      if (active && (unmapped.length > 0 || !mappings.isSuccess || !refs.isSuccess))
        throw new Error(
          'Перед запуском сопоставьте всех включённых сотрудников с активными пользователями amoCRM.',
        );
      if (!effectiveTimezone) throw new Error('Выберите часовой пояс компании.');
      try {
        new Intl.DateTimeFormat('ru', { timeZone: effectiveTimezone });
      } catch {
        throw new Error('Укажите действительный часовой пояс, например Europe/Moscow.');
      }
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
        active,
        algorithm: 'round_robin',
      });
      savedSteps.current.push('состав и настройки группы');
      setSavedGroup(changed);
      setGroupRevision(changed.revision);
      if (effectiveTimezone !== initialTimezone || !settingsLoaded) {
        await api.timezone(effectiveTimezone);
        savedSteps.current.push('часовой пояс компании');
      }
      let nextRule: Rule;
      if (savedRule) {
        nextRule = await api.updateRule(savedRule.id, {
          expectedRevision: ruleRevision ?? savedRule.revision,
          active,
          keepCurrentResponsible: keep,
          pipelineId: pipeline,
          statusId: status,
        });
      } else {
        nextRule = await api.createRule({
          bindingId: binding.bindingId,
          bindingRevision: binding.revision,
          groupId: target.id,
          pipelineId: pipeline,
          statusId: status,
          active,
          keepCurrentResponsible: keep,
        });
      }
      setSavedRule(nextRule);
      setRuleRevision(nextRule.revision);
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
      className={panelClass}
      onSubmit={(event) => {
        event.preventDefault();
        if (!submit.isPending) submit.mutate();
      }}
    >
      <h2 className="text-lg font-semibold">Настройки распределения</h2>
      {!manage && (
        <p role="status" className="mt-2 text-sm text-slate-500">
          Настройки доступны только для просмотра.
        </p>
      )}
      <fieldset disabled={!manage || submit.isPending} className="mt-5 space-y-5">
        <label className="block text-sm">
          Подключение amoCRM
          <select
            disabled={!!savedRule}
            className="mt-2 block w-full rounded-md border border-slate-200 bg-surface p-2"
            value={selectedBinding}
            onChange={(e) => {
              setSelectedBinding(e.target.value);
              setPipeline('');
              setStatus('');
            }}
          >
            <option value="">Выберите подключение</option>
            {connections
              .filter((c) => c.state === 'active')
              .map((c) => (
                <option key={c.bindingId} value={c.bindingId}>
                  Аккаунт {c.accountId}
                </option>
              ))}
          </select>
        </label>
        <Input
          label="Название группы"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={200}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Воронка
            <select
              className="mt-2 block w-full rounded-md border border-slate-200 bg-surface p-2"
              value={pipeline}
              onChange={(e) => {
                setPipeline(e.target.value);
                setStatus('');
              }}
            >
              <option value="">Выберите воронку</option>
              {!refs.data && pipeline && <option value={pipeline}>Воронка {pipeline}</option>}
              {refs.data?.pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Этап
            <select
              className="mt-2 block w-full rounded-md border border-slate-200 bg-surface p-2"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Выберите этап</option>
              {!refs.data && status && <option value={status}>Этап {status}</option>}
              {refs.data?.pipelines
                .find((p) => p.id === pipeline)
                ?.statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <Input
          label="Часовой пояс компании"
          hint="Используется всеми группами и статистикой за сегодня."
          placeholder="Europe/Moscow"
          value={effectiveTimezone}
          onChange={(e) => {
            setTimezoneTouched(true);
            setTimezone(e.target.value);
          }}
        />
        <p className="text-sm">Алгоритм: по очереди (Round-robin)</p>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={keep}
            onChange={(e) => setKeep(e.target.checked)}
          />
          Оставлять сделку у текущего ответственного, если он доступен
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Распределение включено
        </label>
        <div>
          <h3 className="font-semibold">Сотрудники и порядок очереди</h3>
          <ul className="mt-3 space-y-3">
            {members.map((id, index) => {
              const employee = users.find((u) => u.id === id);
              return (
                <li
                  key={id}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 p-3"
                >
                  <span className="min-w-0 flex-1 text-sm">
                    {index + 1}. {employee ? fullName(employee) : 'Удалённый сотрудник'}
                    {unmapped.includes(id) && (
                      <span className="block text-xs text-warning-700">
                        Нет подтверждённой связи с активным пользователем amoCRM
                      </span>
                    )}
                  </span>
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={!disabled.includes(id)}
                      onChange={(e) =>
                        setDisabled((current) =>
                          e.target.checked
                            ? current.filter((value) => value !== id)
                            : [...current, id],
                        )
                      }
                    />
                    Включён
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={index === 0}
                    aria-label={`Поднять ${employee ? fullName(employee) : id}`}
                    onClick={() => move(id, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={index === members.length - 1}
                    aria-label={`Опустить ${employee ? fullName(employee) : id}`}
                    onClick={() => move(id, 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Убрать ${employee ? fullName(employee) : id}`}
                    onClick={() => setMembers((current) => current.filter((value) => value !== id))}
                  >
                    Убрать
                  </Button>
                </li>
              );
            })}
          </ul>
          <label className="mt-3 block text-sm">
            Добавить сотрудника
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) setMembers((current) => [...current, e.target.value]);
              }}
              className="mt-2 block w-full rounded-md border border-slate-200 bg-surface p-2"
            >
              <option value="">Выберите сотрудника</option>
              {users
                .filter((u) => !members.includes(u.id))
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {fullName(u)}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <Button
          type="submit"
          loading={submit.isPending}
          disabled={!binding || (!refs.isSuccess && (active || !savedRule))}
        >
          Сохранить настройки
        </Button>
      </fieldset>
      {!binding && (
        <p role="status" className="mt-3 text-sm text-warning-700">
          Нет активного подключения amoCRM.
        </p>
      )}
      {refs.isError && <Failure error={refs.error} retry={() => void refs.refetch()} />}
      {mappings.isError && <Failure error={mappings.error} retry={() => void mappings.refetch()} />}
      {message && (
        <p role="status" className="mt-4 text-sm">
          {message}
        </p>
      )}
      {submit.isError && manage && (
        <Button
          type="button"
          variant="secondary"
          className="mt-3"
          onClick={() =>
            void reloadVersions().catch(() =>
              setMessage('Не удалось обновить версии. Попробуйте позже.'),
            )
          }
        >
          Загрузить новые версии
        </Button>
      )}
    </form>
  );
}
