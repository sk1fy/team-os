import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { TaskControlRule } from '@/api/taskControl';
import { Button, Switch } from '@/components/ui';
import { preventDismissOnPopoverClick } from '@/components/ui/dismissGuard';
import type { CrmReferences } from './model';
import {
  CustomerStatusPicker,
  IDField,
  ManualPipelines,
  PipelinePicker,
  UserPicker,
} from './RulePickers';
import { CheckRow, FieldLabel, Note } from './ui';

export interface ReferencesState {
  data?: CrmReferences;
  loading: boolean;
}

/** Редактор правила справа, 660 px (`panelHTML()` ветка rule в концепте). */
export function RuleEditorDrawer({
  rule,
  isNew,
  editable,
  references,
  onCommit,
  onDelete,
  onClose,
}: {
  rule: TaskControlRule | undefined;
  isNew: boolean;
  editable: boolean;
  references: ReferencesState;
  onCommit: (rule: TaskControlRule) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog.Root open={!!rule} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-overlay-in fixed inset-0 z-40 bg-ink/25" />
        <Dialog.Content
          aria-describedby={undefined}
          onPointerDownOutside={preventDismissOnPopoverClick}
          onInteractOutside={preventDismissOnPopoverClick}
          className="animate-drawer-in fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-slate-200 bg-surface shadow-[-20px_0_60px_#0f172a26] sm:w-[660px]"
        >
          {rule && (
            <RuleForm
              key={rule.ruleUid}
              rule={rule}
              isNew={isNew}
              editable={editable}
              references={references}
              onCommit={onCommit}
              onDelete={onDelete}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function RuleForm({
  rule: initial,
  isNew,
  editable,
  references,
  onCommit,
  onDelete,
}: {
  rule: TaskControlRule;
  isNew: boolean;
  editable: boolean;
  references: ReferencesState;
  onCommit: (rule: TaskControlRule) => void;
  onDelete: () => void;
}) {
  const [rule, setRule] = useState(initial);
  const update = (changes: Partial<TaskControlRule>) => setRule((r) => ({ ...r, ...changes }));
  const refs = references.data;
  const changed = JSON.stringify(rule) !== JSON.stringify(initial);

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-[22px] py-5 max-sm:px-4 max-sm:py-3.5">
        <div className="min-w-0">
          <div className="text-xs font-semibold tracking-[0.5px] text-slate-500 uppercase">
            Правило
          </div>
          <Dialog.Title className="mt-1 text-lg font-semibold text-ink">
            {isNew ? 'Новое правило' : editable ? 'Редактирование' : 'Просмотр'}
          </Dialog.Title>
        </div>
        <Dialog.Close
          className="grid size-[38px] shrink-0 cursor-pointer place-items-center rounded-[10px] border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-ink"
          aria-label="Закрыть"
        >
          <X className="size-4" aria-hidden="true" />
        </Dialog.Close>
      </div>

      <fieldset
        disabled={!editable}
        className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-[22px] py-5 max-sm:p-4"
      >
        {!editable && (
          <Note>
            Правила сейчас нельзя менять — проверьте подключение на вкладке «Подключение».
          </Note>
        )}
        {!refs && !references.loading && (
          <Note tone="amber">
            Справочник amoCRM сейчас недоступен. Укажите ID пользователей и этапов из amoCRM.
          </Note>
        )}

        <div className="space-y-2">
          <FieldLabel htmlFor="rule-name">Название</FieldLabel>
          <input
            id="rule-name"
            className="h-9.5 w-full rounded-md border border-slate-200 bg-surface px-3 text-sm text-ink focus:outline-2 focus:-outline-offset-1 focus:outline-primary-600 disabled:bg-slate-50 disabled:text-slate-500 dark:disabled:bg-slate-800"
            value={rule.name}
            maxLength={200}
            onChange={(e) => update({ name: e.target.value })}
          />
        </div>

        {refs ? (
          <UserPicker ids={rule.users} users={refs.users} onChange={(users) => update({ users })} />
        ) : references.loading ? (
          <LoadingBlock label="Кого проверяем" />
        ) : (
          <IDField
            label="ID пользователей amoCRM (через запятую)"
            ids={rule.users}
            onChange={(users) => update({ users })}
          />
        )}

        {refs ? (
          <PipelinePicker
            value={rule.pipelines}
            pipelines={refs.pipelines}
            onChange={(pipelines) => update({ pipelines })}
          />
        ) : references.loading ? (
          <LoadingBlock label="Воронки и этапы" />
        ) : (
          <ManualPipelines
            pipelines={rule.pipelines}
            onChange={(pipelines) => update({ pipelines })}
          />
        )}

        <div>
          <FieldLabel>Поведение виджета</FieldLabel>
          <CheckRow
            id="rule-deny-exit"
            label="Запрещать выход без задачи"
            description="Карточку сделки не закрыть, пока в ней нет открытой задачи."
            checked={rule.denyExit}
            onChange={(denyExit) => update({ denyExit })}
          />
          <CheckRow
            id="rule-show-modal"
            label="Показывать окно создания задачи"
            description="Подсказывает сделки без задач и предлагает поставить задачу."
            checked={rule.showModal}
            onChange={(showModal) => update({ showModal })}
          />
          <CheckRow
            id="rule-check-responsible"
            label="Применять только к ответственному"
            description="Правило срабатывает, только если сделку открыл её ответственный. Иначе — у всех выбранных пользователей."
            checked={rule.checkResponsible}
            onChange={(checkResponsible) => update({ checkResponsible })}
          />
          <CheckRow
            id="rule-customers"
            label="Проверять покупателей"
            description="Кроме сделок, правило проверяет карточки покупателей amoCRM."
            checked={rule.customers}
            onChange={(customers) => update({ customers })}
          />
          {rule.customers &&
            (refs ? (
              refs.customersSupported ? (
                <CustomerStatusPicker
                  ids={rule.customerStatuses}
                  statuses={refs.customerStatuses}
                  onChange={(customerStatuses) => update({ customerStatuses })}
                />
              ) : (
                <Note tone="amber">Покупатели недоступны в этом аккаунте amoCRM.</Note>
              )
            ) : (
              <IDField
                label="ID статусов покупателей (пусто — все статусы)"
                ids={rule.customerStatuses}
                onChange={(customerStatuses) => update({ customerStatuses })}
              />
            ))}
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="min-w-0">
            <b className="block text-sm font-[550] text-ink">Правило включено</b>
            <span className="text-xs text-slate-500">
              {rule.enabled
                ? 'Виджет проверяет сделки по этому правилу'
                : 'Правило сохранено, но сделки не проверяются'}
            </span>
          </span>
          <Switch
            checked={rule.enabled}
            onCheckedChange={(enabled) => update({ enabled })}
            aria-label="Правило включено"
            disabled={!editable}
          />
        </div>
        <CheckRow
          id="rule-archived"
          label="В архиве"
          description="Правило хранится в TeamOS, но виджет его не применяет."
          checked={rule.archived}
          onChange={(archived) => update({ archived })}
        />
      </fieldset>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-[22px] py-3.5 max-sm:px-4 max-sm:pb-[calc(12px+env(safe-area-inset-bottom))]">
        {editable && !isNew && (
          <Button
            variant="ghost"
            size="sm"
            className="text-danger-600 hover:bg-danger-50 max-sm:flex-1"
            onClick={onDelete}
          >
            Удалить
          </Button>
        )}
        <span className="flex-1 max-sm:hidden" />
        {editable && (changed || isNew) && (
          <span className="text-xs text-slate-500 max-sm:order-first max-sm:basis-full">
            В виджет — после «Сохранить правила»
          </span>
        )}
        {editable ? (
          <>
            <Dialog.Close asChild>
              <Button variant="secondary" size="sm" className="max-sm:flex-1">
                Отмена
              </Button>
            </Dialog.Close>
            <Button size="sm" className="max-sm:flex-1" onClick={() => onCommit(rule)}>
              Готово
            </Button>
          </>
        ) : (
          <Dialog.Close asChild>
            <Button variant="secondary" size="sm" className="max-sm:flex-1">
              Закрыть
            </Button>
          </Dialog.Close>
        )}
      </div>
    </>
  );
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="space-y-2" aria-busy="true">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex h-24 items-center justify-center rounded-xl border border-slate-200 text-[13px] text-slate-500">
        Загружаем справочник amoCRM…
      </div>
    </div>
  );
}
