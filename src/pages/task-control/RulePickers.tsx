import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Info, Plus, X } from 'lucide-react';
import type { TaskControlRule } from '@/api/taskControl';
import { Avatar, Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import { plural } from '@/lib/format';
import {
  CLOSED_STATUS_IDS,
  crmIds,
  openStatuses,
  pipelineState,
  stageWord,
  toggleId,
  type CrmNamed,
  type CrmPipeline,
  type CrmUser,
} from './model';
import { FieldLabel, Pill, SearchField, Seg, TriCheckbox, idNote, linkButton } from './ui';

type Pipelines = TaskControlRule['pipelines'];

const field =
  'h-9.5 w-full rounded-md border bg-surface px-3 text-sm text-ink focus:outline-2 focus:-outline-offset-1 focus:outline-primary-600 disabled:bg-slate-50 disabled:text-slate-400 dark:disabled:bg-slate-800';

/* ---------- ручной ввод ID (когда справочник amoCRM недоступен) ---------- */

export function IDField({
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
    <label className="block space-y-1.5 text-[13px] font-semibold text-slate-700">
      {label}
      <input
        className={cn(field, 'font-normal', error ? 'border-danger-500' : 'border-slate-200')}
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
      {error && <span className="block text-xs font-normal text-danger-600">{error}</span>}
    </label>
  );
}

export function ManualPipelines({
  pipelines,
  onChange,
}: {
  pipelines: Pipelines;
  onChange: (pipelines: Pipelines) => void;
}) {
  return (
    <div className="space-y-3">
      <FieldLabel>Воронки и этапы сделок</FieldLabel>
      {pipelines.map((p, i) => (
        <div
          className="grid items-end gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_2fr_auto]"
          key={i}
        >
          <label className="block space-y-1.5 text-[13px] font-semibold text-slate-700">
            ID воронки
            <input
              className={cn(field, 'border-slate-200 font-normal')}
              inputMode="numeric"
              value={p.pipelineId}
              onChange={(e) =>
                onChange(
                  pipelines.map((row, j) =>
                    j === i ? { ...row, pipelineId: e.target.value } : row,
                  ),
                )
              }
            />
          </label>
          <IDField
            label="ID этапов"
            ids={p.statusIds}
            onChange={(statusIds) =>
              onChange(pipelines.map((row, j) => (j === i ? { ...row, statusIds } : row)))
            }
          />
          <Button variant="ghost" onClick={() => onChange(pipelines.filter((_, j) => j !== i))}>
            Убрать
          </Button>
        </div>
      ))}
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onChange([...pipelines, { pipelineId: '', statusIds: [] }])}
      >
        <Plus className="size-4" aria-hidden="true" />
        Добавить воронку
      </Button>
    </div>
  );
}

/* ---------- общие части пикеров ---------- */

function Chip({
  children,
  onRemove,
  removeLabel,
  warn,
}: {
  children: ReactNode;
  onRemove?: () => void;
  removeLabel: string;
  warn?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-7 max-w-full items-center gap-1.5 rounded-[7px] pr-1 pl-2.5 text-[12.5px] font-[550] whitespace-nowrap',
        warn
          ? 'bg-warning-50 text-warning-700 dark:bg-warning-600/20 dark:text-amber-300'
          : 'bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-200',
      )}
    >
      <span className="truncate">{children}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="grid size-5 shrink-0 cursor-pointer place-items-center rounded-[5px] opacity-70 hover:bg-surface hover:opacity-100"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

const pickerBox = 'overflow-hidden rounded-xl border border-slate-200 bg-surface';
const pickerTop = 'flex flex-col gap-2.5 border-b border-slate-200 bg-surface-muted p-3';
const pickerList = 'max-h-[340px] overflow-y-auto overscroll-contain';
const emptyRow = 'px-4 py-6 text-center text-[13px] text-slate-500';

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const at = text.toLowerCase().indexOf(query);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-[3px] bg-warning-100 text-inherit dark:bg-warning-600/40">
        {text.slice(at, at + query.length)}
      </mark>
      {text.slice(at + query.length)}
    </>
  );
}

/* ---------- кого проверяем: пользователи amoCRM ---------- */

export function UserPicker({
  ids,
  users,
  onChange,
}: {
  ids: string[];
  users: CrmUser[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [show, setShow] = useState<'all' | 'sel' | 'unsel'>('all');
  const q = query.trim().toLowerCase();
  const selected = new Set(ids);
  const byId = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const unknown = ids.filter((id) => !byId.has(id));
  const known = ids.filter((id) => byId.has(id));
  const visible = users.filter(
    (user) =>
      (!q || user.name.toLowerCase().includes(q) || user.id.includes(q)) &&
      (show === 'all' || (show === 'sel') === selected.has(user.id)),
  );
  const found = q ? visible.filter((user) => user.active && !selected.has(user.id)) : [];
  const selectedCount = users.filter((user) => selected.has(user.id)).length;

  return (
    <div className="space-y-2">
      <FieldLabel>Кого проверяем</FieldLabel>
      <div className={pickerBox}>
        <div className={pickerTop}>
          <div className="flex items-baseline gap-1.5 text-sm">
            <b className="font-semibold text-ink">Выбрано {ids.length}</b>
            <span className="text-slate-500">из {users.length}</span>
            <span className="flex-1" />
            {ids.length > 0 && (
              <button type="button" className={linkButton} onClick={() => onChange([])}>
                Очистить
              </button>
            )}
          </div>
          {ids.length ? (
            <div className="flex flex-wrap gap-1.5">
              {known.slice(0, 5).map((id) => {
                const user = byId.get(id)!;
                return (
                  <Chip
                    key={id}
                    onRemove={() => onChange(toggleId(ids, id))}
                    removeLabel={`Убрать ${user.name}`}
                  >
                    {user.name}
                  </Chip>
                );
              })}
              {known.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShow('sel')}
                  className="h-7 cursor-pointer rounded-[7px] bg-primary-50 px-2.5 text-[12.5px] font-[550] text-primary-700 dark:bg-primary-900 dark:text-primary-200"
                >
                  ещё {known.length - 5}
                </button>
              )}
              {unknown.map((id) => (
                <Chip
                  key={id}
                  warn
                  onRemove={() => onChange(toggleId(ids, id))}
                  removeLabel={`Убрать ID ${id}`}
                >
                  ID {id} · нет в amoCRM
                </Chip>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-slate-500">
              Отметьте пользователей amoCRM, для которых действует правило.
            </p>
          )}
          <SearchField
            value={query}
            onChange={setQuery}
            label="Найти пользователя"
            placeholder="Имя или ID в amoCRM"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Seg
              label="Показать пользователей"
              value={show}
              onChange={setShow}
              options={[
                { key: 'all', label: 'Все', count: users.length },
                { key: 'sel', label: 'Выбранные', count: selectedCount },
                { key: 'unsel', label: 'Не выбранные', count: users.length - selectedCount },
              ]}
            />
            {found.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onChange([...ids, ...found.map((user) => user.id)])}
              >
                <Plus className="size-4" aria-hidden="true" />
                Выбрать найденных ({found.length})
              </Button>
            )}
          </div>
        </div>
        <div className={pickerList}>
          {visible.length ? (
            visible.map((user) => {
              const on = selected.has(user.id);
              const disabled = !user.active && !on;
              return (
                <label
                  key={user.id}
                  className={cn(
                    'flex items-center gap-2.5 border-b border-slate-100 py-[7px] pr-3 pl-3 text-[13.5px] last:border-b-0',
                    disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-slate-50',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={disabled}
                    onChange={() => onChange(toggleId(ids, user.id))}
                    className="size-4 shrink-0 cursor-pointer accent-primary-600 disabled:cursor-not-allowed"
                  />
                  <Avatar name={user.name} size="xs" />
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">
                    <Highlight text={user.name} query={q} />
                  </span>
                  {user.active ? (
                    <span className={idNote}>{user.id}</span>
                  ) : (
                    <span className="text-xs text-slate-500">неактивен в amoCRM</span>
                  )}
                </label>
              );
            })
          ) : (
            <div className={emptyRow}>Никого не нашли</div>
          )}
        </div>
      </div>
      <p className={idNote}>
        Правило действует только на выбранных пользователей amoCRM. Неактивных пользователей выбрать
        нельзя.
      </p>
    </div>
  );
}

/* ---------- воронки и этапы ---------- */

export function PipelinePicker({
  value,
  pipelines,
  onChange,
}: {
  value: Pipelines;
  pipelines: CrmPipeline[];
  onChange: (pipelines: Pipelines) => void;
}) {
  const [query, setQuery] = useState('');
  const [show, setShow] = useState<'all' | 'sel'>('all');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const q = query.trim().toLowerCase();
  const selected = new Map(value.map((row) => [row.pipelineId, row.statusIds]));
  const known = new Map(pipelines.map((pipeline) => [pipeline.id, pipeline]));
  const stageTotal = value.reduce((sum, row) => sum + row.statusIds.length, 0);

  const setStatuses = (pipelineId: string, statusIds: string[]) => {
    if (!statusIds.length) return onChange(value.filter((row) => row.pipelineId !== pipelineId));
    if (selected.has(pipelineId))
      return onChange(
        value.map((row) => (row.pipelineId === pipelineId ? { ...row, statusIds } : row)),
      );
    onChange([...value, { pipelineId, statusIds }]);
  };
  const selectOpen = (pipeline: CrmPipeline) => {
    const current = selected.get(pipeline.id) ?? [];
    const add = openStatuses(pipeline)
      .map((status) => status.id)
      .filter((id) => !current.includes(id));
    setStatuses(pipeline.id, [...current, ...add]);
  };
  const togglePipeline = (pipeline: CrmPipeline) => {
    if (pipelineState(selected.get(pipeline.id), pipeline) === 'all') setStatuses(pipeline.id, []);
    else selectOpen(pipeline);
  };

  const rows = pipelines
    .map((pipeline) => {
      const nameHit = !q || pipeline.name.toLowerCase().includes(q) || pipeline.id.includes(q);
      const statusIds = selected.get(pipeline.id);
      // Закрытые этапы не предлагаются, но уже выбранные видны, чтобы их можно было снять.
      const stages = pipeline.statuses.filter(
        (status) => !CLOSED_STATUS_IDS.has(status.id) || statusIds?.includes(status.id),
      );
      const stageHits = q ? stages.filter((status) => status.name.toLowerCase().includes(q)) : [];
      return { pipeline, nameHit, statusIds, stages, stageHits };
    })
    .filter(
      ({ nameHit, stageHits, statusIds }) =>
        (nameHit || stageHits.length > 0) && (show === 'all' || statusIds),
    );
  const missing = value.filter((row) => !known.has(row.pipelineId));

  return (
    <div className="space-y-2">
      <FieldLabel>Воронки и этапы</FieldLabel>
      <div className={pickerBox}>
        <div className={pickerTop}>
          <div className="flex items-baseline gap-1.5 text-sm">
            <b className="font-semibold text-ink">
              {value.length} {plural(value.length, ['воронка', 'воронки', 'воронок'])}
            </b>
            <span className="text-slate-500">· {stageWord(stageTotal)}</span>
            <span className="flex-1" />
            {value.length > 0 && (
              <button type="button" className={linkButton} onClick={() => onChange([])}>
                Очистить
              </button>
            )}
          </div>
          {value.length ? (
            <div className="flex flex-wrap gap-1.5">
              {value.map(({ pipelineId, statusIds }) => {
                const pipeline = known.get(pipelineId);
                const name = pipeline?.name ?? `Воронка ${pipelineId || '—'}`;
                const whole =
                  pipeline &&
                  pipelineState(statusIds, pipeline) === 'all' &&
                  statusIds.length === openStatuses(pipeline).length;
                return (
                  <Chip
                    key={pipelineId}
                    warn={!pipeline || !statusIds.length}
                    onRemove={() => setStatuses(pipelineId, [])}
                    removeLabel={`Убрать воронку ${name}`}
                  >
                    {name} ·{' '}
                    {!pipeline
                      ? 'нет в amoCRM'
                      : whole
                        ? 'вся воронка'
                        : statusIds.length
                          ? stageWord(statusIds.length)
                          : 'нет этапов'}
                  </Chip>
                );
              })}
            </div>
          ) : (
            <p className="text-[13px] text-slate-500">
              Отметьте воронку целиком или раскройте её и выберите этапы.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <SearchField
              value={query}
              onChange={setQuery}
              label="Найти воронку или этап"
              placeholder="Найти воронку или этап"
            />
            <Seg
              label="Показать воронки"
              value={show}
              onChange={setShow}
              options={[
                { key: 'all', label: 'Все', count: pipelines.length },
                { key: 'sel', label: 'Выбранные', count: value.length - missing.length },
              ]}
            />
          </div>
        </div>
        <div className={pickerList}>
          {rows.length ? (
            rows.map(({ pipeline, nameHit, statusIds, stages, stageHits }) => {
              const state = pipelineState(statusIds, pipeline);
              const expanded = open[pipeline.id] || (q !== '' && !nameHit && stageHits.length > 0);
              const list = q && !nameHit ? stageHits : stages;
              const total = openStatuses(pipeline).length;
              return (
                <div key={pipeline.id} className="border-b border-slate-100 last:border-b-0">
                  <div
                    className={cn(
                      'flex items-center gap-2.5 py-2.5 pr-2.5 pl-3 text-[13.5px]',
                      expanded && 'sticky top-0 z-[1] bg-surface-muted',
                    )}
                  >
                    <TriCheckbox
                      checked={state === 'all'}
                      indeterminate={state === 'some'}
                      onChange={() => togglePipeline(pipeline)}
                      disabled={!total && state === 'none'}
                      aria-label={`Воронка ${pipeline.name}`}
                    />
                    <button
                      type="button"
                      onClick={() => setOpen((map) => ({ ...map, [pipeline.id]: !expanded }))}
                      className="min-w-0 flex-1 cursor-pointer text-left"
                    >
                      <b className="font-semibold text-ink">
                        <Highlight text={pipeline.name} query={q} />
                      </b>{' '}
                      <span className={idNote}>{pipeline.id}</span>
                      <span className="ml-2 text-xs text-slate-500">{stageWord(total)}</span>
                    </button>
                    {state === 'all' ? (
                      <Pill variant="primary">вся воронка</Pill>
                    ) : state === 'some' ? (
                      <span className="text-xs font-semibold text-primary-700 dark:text-primary-300">
                        {statusIds!.length} из {total}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setOpen((map) => ({ ...map, [pipeline.id]: !expanded }))}
                      aria-expanded={expanded}
                      aria-label={`${expanded ? 'Свернуть' : 'Показать этапы'} ${pipeline.name}`}
                      className="grid size-[26px] shrink-0 cursor-pointer place-items-center rounded-[6px] text-slate-500 hover:bg-slate-100 hover:text-ink"
                    >
                      {expanded ? (
                        <ChevronDown className="size-4" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="size-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  {expanded && (
                    <div className="pt-1 pb-2">
                      {list.map((status) => (
                        <label
                          key={status.id}
                          className="flex cursor-pointer items-center gap-2.5 py-1.5 pr-3 pl-[39px] text-[13.5px] select-none hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={!!statusIds?.includes(status.id)}
                            onChange={() =>
                              setStatuses(pipeline.id, toggleId(statusIds ?? [], status.id))
                            }
                            className="size-4 shrink-0 cursor-pointer accent-primary-600"
                          />
                          <span className="min-w-0 flex-1 text-ink">
                            <Highlight text={status.name} query={q} />
                            {CLOSED_STATUS_IDS.has(status.id) && (
                              <span className="ml-2 text-xs text-slate-500">закрытый этап</span>
                            )}
                          </span>
                          <span className={idNote}>{status.id}</span>
                        </label>
                      ))}
                      {!list.length && (
                        <p className="py-1.5 pr-3 pl-[39px] text-[13px] text-slate-500">
                          В воронке нет открытых этапов
                        </p>
                      )}
                      <p className="flex items-center gap-1.5 pt-2 pr-3 pl-[39px] text-xs text-slate-400">
                        <Info className="size-3.5 shrink-0" aria-hidden="true" />
                        Отметка воронки выбирает её открытые этапы. Новые этапы нужно отметить
                        отдельно.
                      </p>
                      {statusIds && (
                        <div className="flex gap-4 pt-2 pr-3 pl-[39px]">
                          <button
                            type="button"
                            className={linkButton}
                            onClick={() => selectOpen(pipeline)}
                          >
                            Все открытые этапы
                          </button>
                          <button
                            type="button"
                            className={linkButton}
                            onClick={() => setStatuses(pipeline.id, [])}
                          >
                            Снять все
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className={emptyRow}>Ничего не нашли</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- статусы покупателей ---------- */

export function CustomerStatusPicker({
  ids,
  statuses,
  onChange,
}: {
  ids: string[];
  statuses: CrmNamed[];
  onChange: (ids: string[]) => void;
}) {
  const unknown = ids.filter((id) => !statuses.some((status) => status.id === id));
  return (
    <div className="space-y-2 pl-[27px] max-sm:pl-0">
      <span className="text-[13px] font-semibold text-slate-700">Статусы покупателей</span>
      {statuses.length ? (
        <div className="grid gap-x-4 sm:grid-cols-2">
          {statuses.map((status) => (
            <label
              key={status.id}
              className="flex cursor-pointer items-center gap-2.5 py-1.5 text-[13.5px] text-ink"
            >
              <input
                type="checkbox"
                checked={ids.includes(status.id)}
                onChange={() => onChange(toggleId(ids, status.id))}
                className="size-4 shrink-0 cursor-pointer accent-primary-600"
              />
              <span className="min-w-0 flex-1">{status.name}</span>
            </label>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-slate-500">В справочнике amoCRM нет статусов покупателей.</p>
      )}
      {unknown.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {unknown.map((id) => (
            <Chip
              key={id}
              warn
              onRemove={() => onChange(toggleId(ids, id))}
              removeLabel={`Убрать статус ${id}`}
            >
              ID {id} · нет в amoCRM
            </Chip>
          ))}
        </div>
      )}
      <p className={idNote}>Ничего не отмечено — проверяются все статусы покупателей.</p>
    </div>
  );
}
