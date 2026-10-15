import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/api';
import { queryKeys } from '@/api/queryKeys';
import {
  taskControlApi as api,
  type TaskControlConnection,
  type TaskControlDraft,
  type TaskControlRule,
  type TaskControlPublication,
} from '@/api/taskControl';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui';
import { crmIds, newRule, readProof } from './model';

const field = 'w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm';
const box = 'rounded-xl border border-slate-200 bg-surface p-5 space-y-4';
const labels = {
  customers: 'Проверять покупателей',
  showModal: 'Показывать окно создания задачи',
  denyExit: 'Запрещать выход без задачи',
  checkResponsible: 'Применять только к ответственному',
  enabled: 'Правило включено',
  archived: 'В архиве',
} as const;
function IDField({
  label,
  ids,
  onChange,
}: {
  label: string;
  ids: string[];
  onChange: (ids: string[]) => void;
}) {
  const [value, setValue] = useState(ids.join(', '));
  const [error, setError] = useState('');
  useEffect(() => {
    setValue((current) => {
      try {
        if (JSON.stringify(crmIds(current)) === JSON.stringify(ids)) return current;
      } catch {
        if (ids.length === 1 && ids[0] === current) return current;
      }
      return ids.join(', ');
    });
  }, [ids]);
  return (
    <label className="block space-y-1 text-sm">
      {label}
      <input
        className={field}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          try {
            const next = crmIds(e.target.value);
            setError('');
            onChange(next);
          } catch (error) {
            onChange([e.target.value]);
            setError((error as Error).message);
          }
        }}
        aria-invalid={!!error}
      />
      {error && <span className="text-danger-700">{error}</span>}
    </label>
  );
}
function RuleEditor({
  rule,
  update,
  remove,
}: {
  rule: TaskControlRule;
  update: (r: TaskControlRule) => void;
  remove: () => void;
}) {
  return (
    <article className={box}>
      <div className="flex items-center gap-3">
        <label className="flex-1 text-sm">
          Название
          <input
            className={field}
            value={rule.name}
            maxLength={200}
            onChange={(e) => update({ ...rule, name: e.target.value })}
          />
        </label>
        <Button variant="ghost" onClick={remove}>
          Удалить
        </Button>
      </div>
      <IDField
        label="ID пользователей amoCRM (через запятую)"
        ids={rule.users}
        onChange={(users) => update({ ...rule, users })}
      />
      <div className="space-y-3">
        <p className="text-sm font-medium">Воронки и этапы сделок</p>
        {rule.pipelines.map((p, i) => (
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]" key={i}>
            <label className="text-sm">
              ID воронки
              <input
                className={field}
                inputMode="numeric"
                value={p.pipelineId}
                onChange={(e) =>
                  update({
                    ...rule,
                    pipelines: rule.pipelines.map((row, j) =>
                      j === i ? { ...row, pipelineId: e.target.value } : row,
                    ),
                  })
                }
              />
            </label>
            <IDField
              label="ID этапов"
              ids={p.statusIds}
              onChange={(statusIds) =>
                update({
                  ...rule,
                  pipelines: rule.pipelines.map((row, j) =>
                    j === i ? { ...row, statusIds } : row,
                  ),
                })
              }
            />
            <Button
              variant="ghost"
              onClick={() =>
                update({ ...rule, pipelines: rule.pipelines.filter((_, j) => j !== i) })
              }
            >
              Убрать
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          onClick={() =>
            update({ ...rule, pipelines: [...rule.pipelines, { pipelineId: '', statusIds: [] }] })
          }
        >
          Добавить воронку
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(labels) as (keyof typeof labels)[]).map((key) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={rule[key]}
              onChange={(e) => update({ ...rule, [key]: e.target.checked })}
            />
            {labels[key]}
          </label>
        ))}
      </div>
      {rule.customers && (
        <IDField
          label="ID статусов покупателей (пусто — все статусы)"
          ids={rule.customerStatuses}
          onChange={(customerStatuses) => update({ ...rule, customerStatuses })}
        />
      )}
    </article>
  );
}
function ConnectionEditor({
  connection,
  refresh,
}: {
  connection: TaskControlConnection;
  refresh: () => Promise<unknown>;
}) {
  const id = connection.scope.bindingId;
  const [draft, setDraft] = useState<TaskControlDraft>();
  const [rules, setRules] = useState<TaskControlRule[]>([]);
  const [publications, setPublications] = useState<TaskControlPublication[]>([]);
  const [proof, setProof] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dirty = !!draft && JSON.stringify(rules) !== JSON.stringify(draft.rules);
  const active = connection.installation.state === 'installed' && connection.state === 'active';
  const fences = {
    expectedBindingRevision: connection.scope.bindingRevision,
    expectedModeEpoch: connection.scope.modeEpoch,
  };
  useEffect(() => {
    let current = true;
    Promise.all([api.getTaskControlDraft(id), api.getTaskControlPublications(id)])
      .then(([d, p]) => {
        if (current) {
          setDraft(d);
          setRules(d.rules);
          setPublications(p.items);
        }
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [id]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const latest = publications[0];
  return (
    <div className="space-y-5">
      <div className={box}>
        <h2 className="text-lg font-semibold">Правила аккаунта</h2>
        <p className="text-sm text-slate-600">
          Режим: {connection.mode === 'managed' ? 'правила из TeamOS' : 'автономный в amoCRM'}.
          Сохранение черновика не меняет работу виджета.
        </p>
        <p className="text-sm text-slate-600">
          В первой версии укажите ID из amoCRM. Существование пользователей и этапов пока не
          сверяется автоматически.
        </p>
        {error && (
          <p role="alert" className="text-danger-700">
            {error} Если версия изменилась, сохраните введённые данные и обновите страницу.
          </p>
        )}
        {notice && (
          <p role="status" className="text-success-700">
            {notice}
          </p>
        )}
        {!draft && !error && <p>Загрузка правил…</p>}
      </div>
      <fieldset disabled={!active || busy || !draft} className="space-y-4 disabled:opacity-60">
        {rules.map((rule, i) => (
          <RuleEditor
            key={rule.ruleUid}
            rule={rule}
            update={(r) => setRules((rows) => rows.map((old, j) => (i === j ? r : old)))}
            remove={() => setRules((rows) => rows.filter((_, j) => i !== j))}
          />
        ))}
        <Button variant="secondary" onClick={() => setRules((rows) => [...rows, newRule()])}>
          Добавить правило
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={!dirty}
            onClick={() =>
              run(async () => {
                if (!draft) return;
                const saved = await api.updateTaskControlDraft(id, {
                  ...fences,
                  expectedRevision: draft.revision,
                  rules,
                });
                setDraft(saved);
                setRules(saved.rules);
                setNotice('Черновик сохранён. Для применения опубликуйте его.');
              })
            }
          >
            Сохранить черновик
          </Button>
          <span className="text-sm text-slate-500">
            {dirty ? 'Есть несохранённые изменения' : `Черновик №${draft?.revision ?? '—'}`}
          </span>
        </div>
        <div className={box}>
          <h2 className="text-lg font-semibold">Публикация</h2>
          <p className="text-sm">
            {latest
              ? `Последняя версия: ${latest.version}. ${latest.rules.length} правил.`
              : 'Опубликованных правил пока нет.'}{' '}
            В режиме TeamOS новая публикация применяется виджетом при следующем обновлении правил.
          </p>
          <label className="block text-sm">
            Комментарий к публикации
            <input
              className={field}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <Button
            disabled={dirty || !draft || !reason.trim()}
            onClick={() =>
              run(async () => {
                if (!draft) return;
                const p = await api.publishTaskControlDraft(id, {
                  ...fences,
                  requestId: crypto.randomUUID(),
                  expectedDraftRevision: draft.revision,
                  expectedChecksum: draft.checksum,
                  reason: reason.trim(),
                });
                setPublications((rows) => [p, ...rows.filter((old) => old.id !== p.id)]);
                setReason('');
                setNotice(
                  'Версия опубликована. В автономном режиме правила amoCRM остаются прежними.',
                );
              })
            }
          >
            Опубликовать сохранённый черновик
          </Button>
          {!!publications.length && (
            <details>
              <summary className="cursor-pointer text-sm">Последние публикации</summary>
              <ul className="mt-3 space-y-2 text-sm">
                {publications.map((p) => (
                  <li key={p.id}>
                    №{p.version} · {new Date(p.createdAt).toLocaleString('ru')} · {p.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
        <div className={box}>
          <h2 className="text-lg font-semibold">Источник правил</h2>
          <p className="text-sm text-slate-600">
            Получите код переключения режима в настройках виджета amoCRM. Код действует 60 секунд.
            После включения TeamOS отметьте соответствующую настройку виджета и нажмите основную
            кнопку «Сохранить» в amoCRM. Для возврата сначала переключите режим здесь, затем
            выключите TeamOS в виджете.
          </p>
          <label className="block text-sm">
            Одноразовый код переключения
            <input
              className={field}
              type="password"
              autoComplete="off"
              value={proof}
              onChange={(e) => setProof(e.target.value)}
            />
          </label>
          <Button
            disabled={!latest || !proof.trim() || dirty}
            onClick={() =>
              run(async () => {
                if (!latest) return;
                const decoded = readProof(proof, 'mode', connection.scope.accountId);
                await api.createTaskControlModeIntent(id, {
                  ...fences,
                  requestId: decoded.requestId,
                  targetMode: connection.mode === 'managed' ? 'standalone' : 'managed',
                  publicationId: latest.id,
                  coreAssertion: proof.trim(),
                });
                setProof('');
                await refresh();
                setNotice(
                  'Источник правил изменён. Завершите переключение в настройках виджета amoCRM.',
                );
              })
            }
          >
            {connection.mode === 'managed'
              ? 'Вернуть автономный режим'
              : 'Использовать правила TeamOS'}
          </Button>
        </div>
      </fieldset>
    </div>
  );
}
export function TaskControlPage() {
  const company = useQuery({ queryKey: queryKeys.company, queryFn: authApi.getCompany });
  const account = company.data?.amoAccountId?.trim() ?? '';
  const status = useQuery({
    queryKey: ['task-control', 'installation', account],
    queryFn: () => api.getTaskControlInstallation(account),
    enabled: !!account,
    retry: false,
  });
  const connections = useQuery({
    queryKey: ['task-control', 'connections', account],
    queryFn: () => api.getTaskControlConnections(),
    enabled: !!account,
    retry: false,
  });
  const [proof, setProof] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const connection = connections.data?.find(
    (c) => c.scope.accountId === account && c.state === 'active',
  );
  const installed = status.data?.state === 'installed';
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Контроль задач"
        description="Правила для amoCRM. Проверка задач выполняется внутри виджета."
      />
      <section className={box}>
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-semibold">Аккаунт amoCRM {account || 'не подключён'}</h2>
          <Button
            variant="secondary"
            disabled={!account || status.isFetching}
            onClick={() => {
              void status.refetch();
              void connections.refetch();
            }}
          >
            Обновить статус
          </Button>
        </div>
        {company.isPending ? (
          <p>Загрузка аккаунта…</p>
        ) : company.isError ? (
          <p role="alert">Не удалось загрузить аккаунт.</p>
        ) : !account ? (
          <p>Подключите аккаунт amoCRM в настройках компании.</p>
        ) : status.isPending ? (
          <p>Проверяем установку…</p>
        ) : (
          <p className={installed ? 'text-success-700' : 'text-slate-500'}>
            {installed
              ? 'Виджет установлен'
              : status.data?.state === 'notInstalled'
                ? 'Виджет не установлен. Интеграция неактивна.'
                : 'Статус установки неизвестен. Проверьте связь с Core и обновите статус.'}
          </p>
        )}
        {(status.error || connections.error) && (
          <p role="alert" className="text-danger-700">
            {(status.error || connections.error)?.message}
          </p>
        )}
      </section>
      {installed && !connection && connections.isSuccess && (
        <section className={box}>
          <h2 className="text-lg font-semibold">Подключить правила TeamOS</h2>
          <p className="text-sm text-slate-600">
            В настройках «Контроля задач» в amoCRM получите код подключения и вставьте его сюда в
            течение 60 секунд. Нужны права администратора amoCRM и TeamOS. Автономные правила при
            подключении не меняются.
          </p>
          <label className="block text-sm">
            Код подключения
            <input
              type="password"
              autoComplete="off"
              className={field}
              value={proof}
              onChange={(e) => setProof(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="text-danger-700">
              {error}
            </p>
          )}
          <Button
            disabled={busy || !proof.trim()}
            onClick={async () => {
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
            Подключить
          </Button>
        </section>
      )}
      {connection && (
        <ConnectionEditor
          key={connection.scope.bindingId}
          connection={{ ...connection, installation: status.data ?? connection.installation }}
          refresh={connections.refetch}
        />
      )}
    </div>
  );
}
