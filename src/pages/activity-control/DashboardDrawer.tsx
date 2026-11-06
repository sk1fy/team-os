import { useState, type ReactNode } from 'react';
import type { ActivityDirectory, ActivityPanel, ActivityPanelInput } from '@/api/activityControl';
import { Button, Input, Switch } from '@/components/ui';
import { CallPlanTable, CallThresholds } from './ActivityOptionsEditor';
import { InspectorDrawer, SegmentTabs } from './InspectorDrawer';
import { PeoplePicker } from './PeoplePicker';
import { Failure, Note, SettingRow } from './shared';
import { emptyPanel, isRejected, panelInput, samePanelInput, withEmployees } from './model';

type EditorTab = 'general' | 'people' | 'calls';

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-[13px] font-semibold text-slate-700">{label}</legend>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </fieldset>
  );
}

function GeneralTab({
  draft,
  setDraft,
  directory,
  timezone,
}: {
  draft: ActivityPanelInput;
  setDraft: (value: ActivityPanelInput) => void;
  directory: ActivityDirectory;
  timezone: string;
}) {
  const pipelines = draft.options.pipelineIds;
  const setWindow = (patch: Partial<ActivityPanelInput['displayWindow']>) =>
    setDraft({ ...draft, displayWindow: { ...draft.displayWindow, ...patch } });
  return (
    <>
      <Input
        label="Название панели"
        value={draft.name}
        maxLength={120}
        placeholder="Например, Отдел продаж"
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
      />
      <SettingRow
        title="Панель включена"
        control={
          <Switch
            aria-label="Панель включена"
            checked={draft.enabled}
            onCheckedChange={(enabled) => setDraft({ ...draft, enabled })}
          />
        }
      />
      <Field label="Время показа" hint={timezone ? `Часовой пояс: ${timezone}` : undefined}>
        <div className="flex items-center gap-2.5">
          <Input
            type="time"
            aria-label="Начало дня"
            className="w-32"
            value={draft.displayWindow.from}
            onChange={(e) => setWindow({ from: e.target.value })}
          />
          <span className="text-slate-400">—</span>
          <Input
            type="time"
            aria-label="Конец дня"
            className="w-32"
            value={draft.displayWindow.to}
            onChange={(e) => setWindow({ to: e.target.value })}
          />
        </div>
      </Field>
      <Field label="Воронки">
        <p className="-mt-1 text-xs text-slate-500">
          {pipelines.length
            ? `Выбрано: ${pipelines.length}`
            : 'Ничего не выбрано — учитываются все доступные воронки'}
        </p>
        {directory.pipelines.length === 0 ? (
          <p className="text-sm text-slate-500">Воронок нет в доступном справочнике.</p>
        ) : (
          <div className="grid gap-x-4 sm:grid-cols-2">
            {directory.pipelines.map((pipeline) => (
              <label key={pipeline.id} className="flex cursor-pointer items-start gap-2.5 py-1.5">
                <input
                  type="checkbox"
                  className="mt-0.5 size-[17px] shrink-0 accent-primary-600"
                  checked={pipelines.includes(pipeline.id)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      options: {
                        ...draft.options,
                        pipelineIds: e.target.checked
                          ? [...pipelines, pipeline.id]
                          : pipelines.filter((id) => id !== pipeline.id),
                      },
                    })
                  }
                />
                <span className="min-w-0 text-sm font-medium text-ink">{pipeline.name}</span>
              </label>
            ))}
          </div>
        )}
      </Field>
      <Note>
        Telegram в новой Activity пока недоступен. Настройки панели общие с виджетом amoCRM.
      </Note>
    </>
  );
}

/**
 * Редактор дашборда (`dashPanel()` концепта): черновик по вкладкам, одна кнопка
 * сохранения. Если результат отправки не подтверждён (сеть, 5xx, 429), форма
 * блокируется и повтор отправляет те же настройки с тем же номером операции.
 */
export function DashboardDrawer({
  panel,
  directory,
  save,
  close,
}: {
  panel?: ActivityPanel;
  directory: ActivityDirectory;
  save: (input: ActivityPanelInput, commandId: string) => Promise<void>;
  close: () => void;
}) {
  const [initial] = useState<ActivityPanelInput>(() => (panel ? panelInput(panel) : emptyPanel()));
  const [draft, setDraft] = useState<ActivityPanelInput>(initial);
  const [tab, setTab] = useState<EditorTab>('general');
  const [command, setCommand] = useState<{ input: ActivityPanelInput; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const valid = draft.name.trim() !== '' && draft.employeeIds.length > 0;
  const dirty = !samePanelInput(draft, initial);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const submitted = command ?? { input: structuredClone(draft), id: crypto.randomUUID() };
      setCommand(submitted);
      await save(submitted.input, submitted.id);
      close();
    } catch (e) {
      if (isRejected(e)) setCommand(null);
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <InspectorDrawer
      eyebrow="Дашборд активности"
      title={panel ? panel.name || 'Без названия' : 'Новый дашборд'}
      subtitle="Настройки применятся после сохранения"
      onClose={() => {
        if (!busy) close();
      }}
      tabs={
        <SegmentTabs
          label="Разделы дашборда"
          idPrefix="activity-dash"
          value={tab}
          onChange={setTab}
          items={[
            { key: 'general', label: 'Общие', marker: !draft.name.trim() },
            { key: 'people', label: 'Сотрудники', marker: draft.employeeIds.length === 0 },
            { key: 'calls', label: 'Звонки' },
          ]}
        />
      }
      footer={
        <>
          {dirty ? (
            <span className="flex basis-full items-center gap-2 text-xs font-medium text-warning-700 sm:basis-auto dark:text-amber-300">
              <i className="size-1.5 rounded-full bg-warning-500" />
              Есть несохранённые изменения
            </span>
          ) : null}
          {!valid && (
            <span className="basis-full text-xs text-slate-500 sm:basis-auto">
              Нужны название и хотя бы один сотрудник
            </span>
          )}
          <span className="flex-1" />
          <Button size="sm" variant="secondary" disabled={busy} onClick={close}>
            Отмена
          </Button>
          <Button size="sm" disabled={busy || !valid} onClick={() => void submit()}>
            {busy ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </>
      }
    >
      {error != null && <Failure error={error} title="Не удалось сохранить" />}
      {command && !busy && (
        <Note tone="amber">
          Результат отправки не подтверждён. Повтор сохранения отправит те же настройки с тем же
          номером операции.
        </Note>
      )}
      <fieldset
        id="activity-dash-panel"
        role="tabpanel"
        aria-labelledby={`activity-dash-tab-${tab}`}
        disabled={busy || command !== null}
        className="flex min-w-0 flex-col gap-[18px]"
      >
        {tab === 'general' && (
          <GeneralTab
            draft={draft}
            setDraft={setDraft}
            directory={directory}
            timezone={panel?.timezone || directory.timezone}
          />
        )}
        {tab === 'people' && (
          <>
            <div className="space-y-1.5">
              <div className="text-[13px] font-semibold text-slate-700">
                Чью активность показывать
              </div>
              <PeoplePicker
                users={directory.users}
                selected={draft.employeeIds}
                onChange={(ids) => setDraft(withEmployees(draft, ids))}
              />
            </div>
            <CallPlanTable
              directory={directory}
              employees={draft.employeeIds}
              value={draft.options}
              change={(options) => setDraft({ ...draft, options })}
            />
          </>
        )}
        {tab === 'calls' && (
          <CallThresholds
            directory={directory}
            draft={draft}
            change={(options) => setDraft({ ...draft, options })}
          />
        )}
      </fieldset>
    </InspectorDrawer>
  );
}
