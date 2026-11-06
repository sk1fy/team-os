import { useState } from 'react';
import { ArrowDown, ArrowUp, Check } from 'lucide-react';
import {
  activityControlApi as api,
  type ActivityDirectory,
  type ActivityTaskPanel,
} from '@/api/activityControl';
import { Switch } from '@/components/ui';
import { toast } from '@/stores/toast';
import { PeoplePicker } from './PeoplePicker';
import { Card, Failure, SettingRow } from './shared';
import { employeesLabel, movePriority, priorityInfo, sameTaskPanel } from './model';

const moveButton =
  'grid size-7 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent';

/**
 * Вкладка «Панель задач» (`taskPanelBody()` концепта): кто видит панель задач
 * виджета Activity и как строится очередь. Черновик сохраняется тёмной плашкой.
 */
export function TaskPanelEditor({
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
  const [base, setBase] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const dirty = !sameTaskPanel(draft, base);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const value = await api.forBinding(bindingId).saveTaskPanel(draft);
      setBase(value);
      setDraft(value);
      saved(value);
      toast.success('Настройки сохранены');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const count = draft.employeeIds.length;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-slate-500">
        Кто видит панель задач в виджете Activity и как строится очередь. Изменения применятся после
        сохранения. Правила «Контроля задач» настраиваются отдельно.
      </p>
      {error != null && <Failure error={error} title="Не удалось сохранить" />}
      <fieldset disabled={busy} className="grid min-w-0 items-start gap-4 lg:grid-cols-2">
        <Card title="Кто видит панель задач">
          <SettingRow
            title="Панель задач включена"
            hint={
              draft.enabled
                ? count
                  ? `Панель видят ${employeesLabel(count)}`
                  : 'Сотрудники не выбраны'
                : 'Панель задач выключена'
            }
            control={
              <Switch
                aria-label="Панель задач включена"
                checked={draft.enabled}
                onCheckedChange={(enabled) => setDraft({ ...draft, enabled })}
                disabled={busy}
              />
            }
          />
          <div className="mt-3.5">
            <PeoplePicker
              users={directory.users}
              selected={draft.employeeIds}
              onChange={(employeeIds) => setDraft({ ...draft, employeeIds })}
              disabled={busy}
            />
          </div>
        </Card>
        <div className="flex min-w-0 flex-col gap-4">
          <Card title="Что попадает в очередь">
            <div className="flex flex-col gap-3.5">
              <SettingRow
                title="Учитывать будущие задачи"
                hint="Задачи на завтра и позже тоже попадут в очередь"
                control={
                  <Switch
                    aria-label="Учитывать будущие задачи"
                    checked={draft.considerFutureTasks}
                    onCheckedChange={(considerFutureTasks) =>
                      setDraft({ ...draft, considerFutureTasks })
                    }
                    disabled={busy}
                  />
                }
              />
              <SettingRow
                title="Учитывать связанные сделки"
                hint="Задачи по сделкам, где менеджер участник, но не ответственный"
                control={
                  <Switch
                    aria-label="Учитывать связанные сделки"
                    checked={draft.includeRelatedDeals}
                    onCheckedChange={(includeRelatedDeals) =>
                      setDraft({ ...draft, includeRelatedDeals })
                    }
                    disabled={busy}
                  />
                }
              />
            </div>
          </Card>
          <Card title="Приоритеты задач">
            <p className="mb-1.5 text-[13px] text-slate-500">
              В таком порядке панель показывает задачи менеджеру.
            </p>
            <ol aria-label="Порядок приоритетов">
              {draft.priorityKeys.map((key, index) => {
                const { label, description } = priorityInfo(key);
                return (
                  <li
                    key={key}
                    className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-b-0"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700 dark:bg-primary-900 dark:text-primary-100">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-ink">{label}</div>
                      {description && (
                        <div className="mt-0.5 text-xs text-slate-500">{description}</div>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-0.5">
                      <button
                        type="button"
                        className={moveButton}
                        aria-label={`Выше: ${label}`}
                        title="Выше"
                        disabled={busy || index === 0}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            priorityKeys: movePriority(draft.priorityKeys, index, -1),
                          })
                        }
                      >
                        <ArrowUp className="size-4" />
                      </button>
                      <button
                        type="button"
                        className={moveButton}
                        aria-label={`Ниже: ${label}`}
                        title="Ниже"
                        disabled={busy || index === draft.priorityKeys.length - 1}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            priorityKeys: movePriority(draft.priorityKeys, index, 1),
                          })
                        }
                      >
                        <ArrowDown className="size-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>
      </fieldset>
      {(dirty || busy) && (
        <div
          role="region"
          aria-label="Несохранённые изменения"
          className="sticky bottom-4 z-20 mt-1 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[14px] bg-[#151b26] py-2.5 pr-2.5 pl-[18px] text-sm text-slate-200 shadow-[0_12px_32px_#0f172a40] dark:ring-1 dark:ring-slate-700"
        >
          <span className="flex min-w-0 flex-1 basis-56 items-center gap-3">
            <span className="size-2 shrink-0 rounded-full bg-[#f5b94a] shadow-[0_0_0_4px_#f5b94a33]" />
            <span>
              <b className="font-semibold text-white">Панель задач</b> · есть несохранённые
              изменения
            </span>
          </span>
          <span className="ml-auto flex shrink-0 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setDraft(base);
                setError(null);
              }}
              className="h-[34px] rounded-[9px] border border-[#374151] px-3.5 text-[13px] font-semibold text-slate-300 transition-colors hover:bg-[#1f2937] disabled:opacity-50"
            >
              Отменить
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="inline-flex h-[34px] items-center gap-1.5 rounded-[9px] bg-[#4fae9f] px-3.5 text-[13px] font-semibold text-[#08201c] transition-colors hover:bg-[#63c1b2] disabled:opacity-60"
            >
              <Check className="size-4" />
              {busy ? 'Сохранение…' : 'Сохранить'}
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
