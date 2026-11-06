import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ListChecks, Plus } from 'lucide-react';
import type { TaskControlRule } from '@/api/taskControl';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar, Button, Switch } from '@/components/ui';
import { cn } from '@/lib/cn';
import { plural } from '@/lib/format';
import {
  countChanges,
  newRule,
  ruleChange,
  ruleLimits,
  scopeLines,
  userWord,
  type CrmReferences,
} from './model';
import { RuleEditorDrawer, type ReferencesState } from './RuleEditorDrawer';
import {
  CONNECTION_TAB_HREF,
  TASK_CONTROL_DESCRIPTION,
  installationText,
  type TaskControlState,
} from './shared';
import { Card, Note, Pill, Problem, Pubbar, idNote } from './ui';
import type { RulesDraft } from './useRulesDraft';

/** Вкладка «Правила»: таблица правил, редактор справа и плашка несохранённых правок. */
export function TaskRulesTab({
  state,
  editor,
  references,
}: {
  state: TaskControlState;
  editor: RulesDraft;
  references: ReferencesState;
}) {
  const [editing, setEditing] = useState<{ rule: TaskControlRule; isNew: boolean }>();
  const add = () => setEditing({ rule: newRule(), isNew: true });

  return (
    <>
      <PageHeader
        title="Правила"
        description={TASK_CONTROL_DESCRIPTION}
        actions={
          <Button onClick={add} disabled={!editor.editable}>
            <Plus className="size-4" aria-hidden="true" />
            Добавить правило
          </Button>
        }
      />
      <div className="space-y-4">
        <RulesBody
          state={state}
          editor={editor}
          references={references}
          onOpen={setEditing}
          onAdd={add}
        />
      </div>
      <RuleEditorDrawer
        rule={editing?.rule}
        isNew={!!editing?.isNew}
        editable={editor.editable}
        references={references}
        onClose={() => setEditing(undefined)}
        onCommit={(rule) => {
          editor.setRules((rows) =>
            editing?.isNew
              ? [...rows, rule]
              : rows.map((row) => (row.ruleUid === rule.ruleUid ? rule : row)),
          );
          setEditing(undefined);
        }}
        onDelete={() => {
          const uid = editing?.rule.ruleUid;
          editor.setRules((rows) => rows.filter((row) => row.ruleUid !== uid));
          setEditing(undefined);
        }}
      />
    </>
  );
}

function ConnectionLink({ children = 'Открыть «Подключение»' }: { children?: ReactNode }) {
  return (
    <Link
      to={CONNECTION_TAB_HREF}
      className="inline-flex h-8 items-center rounded-md bg-primary-600 px-3 text-[13px] font-semibold text-white hover:bg-primary-700"
    >
      {children}
    </Link>
  );
}

function Loading({ children }: { children: ReactNode }) {
  return (
    <Card>
      <p className="py-6 text-center text-sm text-slate-500" aria-busy="true">
        {children}
      </p>
    </Card>
  );
}

function RulesBody({
  state,
  editor,
  references,
  onOpen,
  onAdd,
}: {
  state: TaskControlState;
  editor: RulesDraft;
  references: ReferencesState;
  onOpen: (editing: { rule: TaskControlRule; isNew: boolean }) => void;
  onAdd: () => void;
}) {
  const { company, account, status, connections, connection, installed } = state;
  if (company.isPending) return <Loading>Загрузка аккаунта…</Loading>;
  if (company.isError) return <Problem role="alert" title="Не удалось загрузить аккаунт." />;
  if (!account)
    return (
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
      >
        Правила «Контроля задач» работают в аккаунте amoCRM компании.
      </Problem>
    );
  if (status.isPending || connections.isPending) return <Loading>Проверяем установку…</Loading>;

  const error = status.error ?? connections.error;
  return (
    <>
      {!installed && (
        <Problem title={installationText(status.data?.state)} action={<ConnectionLink />}>
          {status.data?.state === 'notInstalled'
            ? 'Правила не применяются, пока виджет не установлен в amoCRM.'
            : 'Обновите статус на вкладке «Подключение».'}
        </Problem>
      )}
      {error && (
        <Note tone="red" role="alert">
          {error.message}
        </Note>
      )}
      {connection ? (
        <RulesTable editor={editor} refs={references.data} onOpen={onOpen} onAdd={onAdd} />
      ) : (
        connections.isSuccess && (
          <Card>
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <span className="grid size-11 place-items-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-900 dark:text-primary-200">
                <ListChecks className="size-5" aria-hidden="true" />
              </span>
              <h2 className="text-base font-semibold text-ink">Правила ещё недоступны</h2>
              <p className="max-w-md text-sm text-slate-500">
                {installed
                  ? 'Подключите правила TeamOS: получите код в настройках «Контроля задач» в amoCRM и введите его на вкладке «Подключение».'
                  : 'Установите виджет «Контроль задач» в amoCRM, затем подключите правила TeamOS на вкладке «Подключение».'}
              </p>
              <ConnectionLink>Перейти к подключению</ConnectionLink>
            </div>
          </Card>
        )
      )}
    </>
  );
}

function RulesTable({
  editor,
  refs,
  onOpen,
  onAdd,
}: {
  editor: RulesDraft;
  refs: CrmReferences | undefined;
  onOpen: (editing: { rule: TaskControlRule; isNew: boolean }) => void;
  onAdd: () => void;
}) {
  const { draft, rules, error, notice, dirty, editable } = editor;
  const changes = draft ? countChanges(rules, draft.rules) : 0;
  const showPubbar = dirty || (!!error && editor.canSave);

  return (
    <>
      {error && (
        <Note tone="red" role="alert">
          {error} Если версия изменилась, сохраните введённые данные и обновите страницу.
        </Note>
      )}
      {notice && !dirty && (
        <Note tone="green" role="status" icon={<CheckCircle2 className="size-4" />}>
          {notice}
        </Note>
      )}
      {!draft ? (
        !error && <Loading>Загрузка правил…</Loading>
      ) : !rules.length ? (
        <Card bodyClassName="p-0">
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <span className="grid size-11 place-items-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-900 dark:text-primary-200">
              <ListChecks className="size-5" aria-hidden="true" />
            </span>
            <h2 className="text-base font-semibold text-ink">Правил пока нет</h2>
            <p className="max-w-md text-sm text-slate-500">
              Правило задаёт, кого проверять, в каких воронках и что делать со сделками без задач.
            </p>
            <Button size="sm" variant="secondary" onClick={onAdd} disabled={!editable}>
              Создать правило
            </Button>
          </div>
          <TableFooter editor={editor} showSave={!showPubbar} />
        </Card>
      ) : (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-surface shadow-card">
          <table className="w-full border-collapse text-left max-md:block">
            <thead className="max-md:hidden">
              <tr>
                {['Правило', 'Кого проверяем', 'Воронки и этапы', 'Ограничения'].map((title) => (
                  <th key={title} className={th}>
                    {title}
                  </th>
                ))}
                <th className={cn(th, 'text-right')}>Включено</th>
              </tr>
            </thead>
            <tbody className="max-md:block">
              {rules.map((rule) => (
                <RuleRow
                  key={rule.ruleUid}
                  rule={rule}
                  editor={editor}
                  refs={refs}
                  onOpen={() => onOpen({ rule, isNew: false })}
                />
              ))}
            </tbody>
          </table>
          <TableFooter editor={editor} showSave={!showPubbar} />
        </section>
      )}
      {showPubbar && (
        <Pubbar
          busy={editor.busy}
          canSave={editor.canSave}
          onSave={() => void editor.save()}
          onDiscard={dirty ? editor.discard : undefined}
          saveLabel="Сохранить правила"
        >
          <b className="font-semibold text-white">Правила</b> ·{' '}
          {changes
            ? `${changes} ${plural(changes, ['изменение', 'изменения', 'изменений'])} ${plural(changes, ['не сохранено', 'не сохранены', 'не сохранено'])}`
            : dirty
              ? 'Есть несохранённые изменения'
              : 'не сохранены в виджете'}
        </Pubbar>
      )}
    </>
  );
}

const th =
  'border-b border-slate-200 bg-surface-muted px-3.5 py-3 text-xs font-semibold whitespace-nowrap text-slate-500';
const td =
  'border-b border-slate-100 px-3.5 py-3 align-middle text-sm max-md:block max-md:border-0 max-md:p-0';

function TableFooter({ editor, showSave }: { editor: RulesDraft; showSave: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
      <span>Виджет получает сохранённые правила из TeamOS при следующем обновлении.</span>
      {showSave && editor.canSave && (
        <Button size="sm" variant="secondary" onClick={() => void editor.save()}>
          Сохранить правила
        </Button>
      )}
    </div>
  );
}

function RuleRow({
  rule,
  editor,
  refs,
  onOpen,
}: {
  rule: TaskControlRule;
  editor: RulesDraft;
  refs: CrmReferences | undefined;
  onOpen: () => void;
}) {
  const saved = editor.draft?.rules.find((row) => row.ruleUid === rule.ruleUid);
  const change = editor.draft ? ruleChange(rule, editor.draft.rules) : undefined;
  const limits = ruleLimits(rule);
  const lines = scopeLines(rule, refs);
  const hidden = lines.slice(2);
  const title = rule.name.trim() || 'Без названия';
  // «Работает в виджете» — только про сохранённую версию правила.
  const stateText = rule.archived
    ? 'В архиве'
    : !rule.enabled
      ? 'Выключено'
      : !saved || saved.archived || !saved.enabled
        ? 'Включится после сохранения'
        : editor.active
          ? 'Работает в виджете'
          : 'Включено';

  return (
    <tr
      onClick={onOpen}
      className={cn(
        'cursor-pointer transition-colors hover:bg-slate-50 max-md:flex max-md:flex-wrap max-md:items-center max-md:gap-x-2.5 max-md:gap-y-1.5 max-md:border-b max-md:border-slate-100 max-md:px-3.5 max-md:py-3 max-md:last:border-b-0 dark:hover:bg-slate-800/40',
        rule.archived && 'opacity-70',
      )}
    >
      <td className={cn(td, 'max-md:order-[-2] max-md:min-w-0 max-md:flex-[1_1_calc(100%-80px)]')}>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
            className="cursor-pointer text-left font-semibold text-ink hover:underline"
          >
            {title}
          </button>
          {change && <Pill variant="warning">{change === 'new' ? 'новое' : 'изменено'}</Pill>}
        </div>
        <div className="mt-0.5 text-[13px] text-slate-500">{stateText}</div>
      </td>
      <td className={cn(td, 'max-md:max-w-full')}>
        <WhoCell ids={rule.users} refs={refs} />
      </td>
      <td className={cn(td, 'max-md:max-w-full')}>
        {lines.length ? (
          <div className="space-y-0.5">
            {lines.slice(0, 2).map((line, i) => (
              <div key={i} className="text-[13px]">
                <b className="font-[550] text-ink">{line.name}</b>{' '}
                <span className={line.warn ? 'text-warning-700' : 'text-slate-500'}>
                  · {line.detail}
                </span>
              </div>
            ))}
            {hidden.length > 0 && (
              <div className="text-[13px] text-slate-500">
                ещё{' '}
                {hidden.length <= 2
                  ? hidden.map((line) => line.name).join(', ')
                  : `${hidden.length} ${plural(hidden.length, ['воронка', 'воронки', 'воронок'])}`}
              </div>
            )}
          </div>
        ) : (
          <span className="text-[13px] text-warning-700">Воронки не выбраны</span>
        )}
      </td>
      <td className={cn(td, 'max-md:max-w-full')}>
        <div className="flex flex-wrap gap-1.5">
          {limits.map((limit) => (
            <Pill key={limit}>{limit}</Pill>
          ))}
        </div>
      </td>
      <td
        className={cn(td, 'text-right max-md:order-[-1] max-md:flex-none')}
        onClick={(event) => event.stopPropagation()}
      >
        <Switch
          className="inline-flex"
          checked={rule.enabled}
          disabled={!editor.editable}
          aria-label={`Правило «${title}» включено`}
          onCheckedChange={(enabled) =>
            editor.setRules((rows) =>
              rows.map((row) => (row.ruleUid === rule.ruleUid ? { ...row, enabled } : row)),
            )
          }
        />
      </td>
    </tr>
  );
}

function WhoCell({ ids, refs }: { ids: string[]; refs: CrmReferences | undefined }) {
  if (!ids.length) return <span className="text-[13px] text-warning-700">Никто не выбран</span>;
  if (!refs)
    return (
      <div>
        <div className="text-[13px] text-ink">{userWord(ids.length)}</div>
        <div className={idNote}>
          ID {ids.slice(0, 3).join(', ')}
          {ids.length > 3 ? '…' : ''}
        </div>
      </div>
    );
  const names = ids.map((id) => refs.users.find((user) => user.id === id)?.name ?? `ID ${id}`);
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className="flex -space-x-1.5">
          {names.slice(0, 3).map((name, i) => (
            <span key={i} title={name} className="rounded-full ring-2 ring-surface">
              <Avatar name={name} size="xs" />
            </span>
          ))}
        </span>
        {names.length > 3 && <span className="text-xs text-slate-500">+{names.length - 3}</span>}
      </div>
      <div className="mt-1 max-w-[220px] truncate text-xs text-slate-500">
        {names.length === 1 ? names[0] : `${names.length} чел.`}
      </div>
    </div>
  );
}
