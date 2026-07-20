import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Beaker, Pencil, Plus, ScrollText, Trash2 } from 'lucide-react';
import { queryKeys } from '@/api/queryKeys';
import {
  createDefaultRuleSettings,
  createLeadRule,
  duplicatesApi,
  type DuplicateFieldClause,
  type DuplicateResources,
  type DuplicateRule,
  type DuplicateRuleSettings,
  type LeadDuplicateRule,
} from '@/api/rakurs/duplicates';
import type { RakursContext } from '@/api/rakurs/client';
import { Button, Input, Modal, MultiSelect, Select } from '@/components/ui';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { createId } from '@/lib/id';
import { toast } from '@/stores/toast';
import { CheckField, FieldClausesEditor, SectionCard, Segmented, Toggle } from './controls';

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

function RuleEditor({
  open,
  rule,
  resources,
  pending,
  onClose,
  onSave,
}: {
  open: boolean;
  rule?: DuplicateRule;
  resources: DuplicateResources;
  pending: boolean;
  onClose: () => void;
  onSave: (settings: DuplicateRuleSettings, token?: string) => void;
}) {
  const [step, setStep] = useState(0);
  const [settings, setSettings] = useState<DuplicateRuleSettings>(() =>
    structuredClone(rule?.setting ?? createDefaultRuleSettings()),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const contactEntries = Object.entries(settings.searchСonditionContact);
  const companyEntries = Object.entries(settings.searchСonditionCompany);
  const fieldOptions = resources.fields;

  const updateClauseMap = (
    key: 'searchСonditionContact' | 'searchСonditionCompany',
    entries: [string, DuplicateFieldClause][],
  ) => setSettings((current) => ({ ...current, [key]: Object.fromEntries(entries) }));

  const validateFirstStep = () => {
    const next: Record<string, string> = {};
    if (!settings.name.trim()) next.name = 'Введите название правила';
    if (!contactEntries.some(([, clause]) => clause.fields.length > 0)) {
      next.contacts = 'Выберите хотя бы одно поле контакта';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const next = () => {
    if (step === 0 && !validateFirstStep()) return;
    setStep((current) => Math.min(2, current + 1));
  };

  const updateLeadRule = (index: number, patch: Partial<LeadDuplicateRule>) =>
    setSettings((current) => ({
      ...current,
      leadsRules: current.leadsRules.map((leadRule, itemIndex) =>
        itemIndex === index ? { ...leadRule, ...patch } : leadRule,
      ),
    }));

  return (
    <Modal
      open={open}
      onOpenChange={(nextOpen) => !nextOpen && onClose()}
      title={rule ? 'Редактирование правила' : 'Новое правило'}
      description={`Шаг ${step + 1} из 3: ${['Контакты и компании', 'Сделки', 'Сценарии'][step]}`}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          {step > 0 && (
            <Button variant="secondary" onClick={() => setStep((value) => value - 1)}>
              Назад
            </Button>
          )}
          {step < 2 ? (
            <Button onClick={next}>Далее</Button>
          ) : (
            <Button loading={pending} onClick={() => onSave(settings, rule?.token)}>
              {rule ? 'Сохранить правило' : 'Создать правило'}
            </Button>
          )}
        </>
      }
    >
      <div className="mb-6 grid grid-cols-3 gap-2" aria-label="Этапы настройки">
        {['Контакты / компании', 'Сделки', 'Сценарии'].map((label, index) => (
          <div
            key={label}
            className={`rounded-md px-3 py-2 text-center text-xs font-semibold ${index === step ? 'bg-primary-50 text-primary-700' : index < step ? 'bg-slate-100 text-slate-700' : 'bg-slate-50 text-slate-400'}`}
          >
            {index + 1}. {label}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-6">
          <Input
            label="Название правила"
            value={settings.name}
            error={errors.name}
            onChange={(event) => setSettings({ ...settings, name: event.target.value })}
            placeholder="Например, проверка входящих сделок"
          />
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Поиск контактов</h3>
            <p className="mb-3 mt-1 text-xs text-slate-500">Можно задать до трёх групп условий.</p>
            <FieldClausesEditor
              clauses={contactEntries.map(([, clause]) => clause)}
              options={fieldOptions}
              minRows={3}
              allowAdd={false}
              optionFilter={(option) => option.entity === 'contacts'}
              onChange={(clauses) =>
                updateClauseMap(
                  'searchСonditionContact',
                  clauses.map((clause, index) => [
                    contactEntries[index]?.[0] ?? String(index + 1),
                    clause,
                  ]),
                )
              }
            />
            {errors.contacts && <p className="mt-2 text-xs text-danger-600">{errors.contacts}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-sm text-slate-600">При нахождении дубля склеить:</span>
              <Segmented
                value={settings.unionMethodContact}
                onChange={(unionMethodContact) => setSettings({ ...settings, unionMethodContact })}
                ariaLabel="Метод склейки контактов"
                options={[
                  { value: 'old', label: 'В старую карточку' },
                  { value: 'new', label: 'В новую карточку' },
                ]}
              />
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Поиск компаний</h3>
            <FieldClausesEditor
              clauses={companyEntries.map(([, clause]) => clause)}
              options={fieldOptions}
              minRows={1}
              allowAdd={false}
              optionFilter={(option) => option.entity === 'companies'}
              onChange={(clauses) =>
                updateClauseMap(
                  'searchСonditionCompany',
                  clauses.map((clause, index) => [
                    companyEntries[index]?.[0] ?? String(index + 1),
                    clause,
                  ]),
                )
              }
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-sm text-slate-600">При нахождении дубля склеить:</span>
              <Segmented
                value={settings.unionMethodCompany}
                onChange={(unionMethodCompany) => setSettings({ ...settings, unionMethodCompany })}
                ariaLabel="Метод склейки компаний"
                options={[
                  { value: 'old', label: 'В старую карточку' },
                  { value: 'new', label: 'В новую карточку' },
                ]}
              />
            </div>
          </div>
          <Select
            label="Salesbot после поиска контакта"
            placeholder="Не запускать"
            value={settings.searchContactFinishRunSalesBotId ?? undefined}
            onValueChange={(value) =>
              setSettings({ ...settings, searchContactFinishRunSalesBotId: value })
            }
            options={resources.salesbots}
          />
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Правила поиска сделок</h3>
              <p className="mt-1 text-xs text-slate-500">Можно создать до трёх вариантов.</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled={settings.leadsRules.length >= 3}
              onClick={() =>
                setSettings({ ...settings, leadsRules: [...settings.leadsRules, createLeadRule()] })
              }
            >
              <Plus className="size-4" /> Добавить правило
            </Button>
          </div>
          <Segmented
            value={settings.typeSearchLeads}
            onChange={(typeSearchLeads) => setSettings({ ...settings, typeSearchLeads })}
            ariaLabel="Связь поиска сделок"
            options={[
              { value: 'contact', label: 'По контакту' },
              { value: 'company', label: 'По компании' },
            ]}
          />
          {settings.leadsRules.map((leadRule, index) => (
            <div key={leadRule.index} className="rounded-lg border border-slate-200 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-slate-900">Правило {index + 1}</h4>
                {settings.leadsRules.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger-600"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        leadsRules: settings.leadsRules.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <Trash2 className="size-4" /> Удалить
                  </Button>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <span className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Поля сделки
                  </span>
                  <MultiSelect
                    options={fieldOptions.filter((option) => option.entity === 'leads')}
                    values={leadRule.fields}
                    onValuesChange={(fields) => updateLeadRule(index, { fields })}
                    placeholder="Выберите поля"
                    formatCount={(count) => `Выбрано полей: ${count}`}
                  />
                </div>
                <div>
                  <span className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Этапы воронок
                  </span>
                  <MultiSelect
                    options={resources.stages}
                    values={leadRule.stages}
                    onValuesChange={(stages) => updateLeadRule(index, { stages })}
                    placeholder="Все этапы"
                    formatCount={(count) => `Выбрано этапов: ${count}`}
                  />
                </div>
                <Input
                  label="Игнорировать подстроку"
                  value={leadRule.ignore}
                  onChange={(event) => updateLeadRule(index, { ignore: event.target.value })}
                />
                <Select
                  label="Объединение сделки"
                  value={leadRule.unionMethodLead}
                  onValueChange={(value) =>
                    updateLeadRule(index, {
                      unionMethodLead: value as LeadDuplicateRule['unionMethodLead'],
                    })
                  }
                  options={[
                    { value: 'nothing', label: 'Не объединять' },
                    { value: 'old', label: 'В старую сделку' },
                    { value: 'new', label: 'В новую сделку' },
                  ]}
                />
                <Select
                  label="Назначить ответственного"
                  value={leadRule.responsibleId ?? undefined}
                  placeholder="Не менять"
                  onValueChange={(responsibleId) => updateLeadRule(index, { responsibleId })}
                  options={resources.managers}
                />
                <Select
                  label="Запустить Salesbot"
                  value={leadRule.salesbotId ?? undefined}
                  placeholder="Не запускать"
                  onValueChange={(salesbotId) => updateLeadRule(index, { salesbotId })}
                  options={resources.salesbots}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 p-4">
            <Toggle
              checked={settings.script_last_lead}
              onCheckedChange={(script_last_lead) => setSettings({ ...settings, script_last_lead })}
              label="Сценарий для последней сделки"
              description="Изменить последнюю найденную сделку после проверки."
            />
            {settings.script_last_lead && (
              <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 md:grid-cols-3">
                <div>
                  <span className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Добавить теги
                  </span>
                  <MultiSelect
                    options={resources.tags}
                    values={settings.script_last_lead_settings.tag}
                    onValuesChange={(tag) =>
                      setSettings({
                        ...settings,
                        script_last_lead_settings: { ...settings.script_last_lead_settings, tag },
                      })
                    }
                    placeholder="Не добавлять"
                    formatCount={(count) => `Выбрано: ${count}`}
                  />
                </div>
                <Select
                  label="Перенести на этап"
                  value={settings.script_last_lead_settings.move_stage ?? undefined}
                  placeholder="Не переносить"
                  onValueChange={(move_stage) =>
                    setSettings({
                      ...settings,
                      script_last_lead_settings: {
                        ...settings.script_last_lead_settings,
                        move_stage,
                      },
                    })
                  }
                  options={resources.stages}
                />
                <Select
                  label="Запустить Salesbot"
                  value={settings.script_last_lead_settings.salesbotId ?? undefined}
                  placeholder="Не запускать"
                  onValueChange={(salesbotId) =>
                    setSettings({
                      ...settings,
                      script_last_lead_settings: {
                        ...settings.script_last_lead_settings,
                        salesbotId,
                      },
                    })
                  }
                  options={resources.salesbots}
                />
              </div>
            )}
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <Toggle
              checked={settings.script_run_widget}
              onCheckedChange={(script_run_widget) =>
                setSettings({ ...settings, script_run_widget })
              }
              label="Сценарий для сделки, запустившей виджет"
              description="Выполнить действия с исходной сделкой после поиска."
            />
            {settings.script_run_widget && (
              <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 md:grid-cols-2">
                <Select
                  label="Назначить ответственного"
                  value={settings.script_run_widget_settings.responsibleId ?? undefined}
                  placeholder="Не менять"
                  onValueChange={(responsibleId) =>
                    setSettings({
                      ...settings,
                      script_run_widget_settings: {
                        ...settings.script_run_widget_settings,
                        responsibleId,
                      },
                    })
                  }
                  options={resources.managers}
                />
                <Select
                  label="Перенести на этап"
                  value={settings.script_run_widget_settings.move_stage ?? undefined}
                  placeholder="Не переносить"
                  onValueChange={(move_stage) =>
                    setSettings({
                      ...settings,
                      script_run_widget_settings: {
                        ...settings.script_run_widget_settings,
                        move_stage,
                      },
                    })
                  }
                  options={resources.stages}
                />
              </div>
            )}
          </div>
          <CheckField
            checked={settings.no_comment}
            onCheckedChange={(no_comment) => setSettings({ ...settings, no_comment })}
            label="Не создавать примечание об объединении"
          />
        </div>
      )}
    </Modal>
  );
}

export function RulesTab({
  context,
  resources,
}: {
  context: RakursContext;
  resources: DuplicateResources;
}) {
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<{ key: string; rule?: DuplicateRule } | null>(null);
  const [deleting, setDeleting] = useState<DuplicateRule | null>(null);
  const [testing, setTesting] = useState<DuplicateRule | null>(null);
  const [leadId, setLeadId] = useState('');

  const rulesQuery = useQuery({
    queryKey: queryKeys.duplicates.rules(context.accountId),
    queryFn: ({ signal }) => duplicatesApi.getRules(context, signal),
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.duplicates.rules(context.accountId) });
  const saveMutation = useMutation({
    mutationFn: ({ settings, token }: { settings: DuplicateRuleSettings; token?: string }) =>
      duplicatesApi.saveRule(context, settings, token),
    onSuccess: (message) => {
      toast.success(message);
      setEditor(null);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error, 'Не удалось сохранить правило')),
  });
  const deleteMutation = useMutation({
    mutationFn: (token: string) => duplicatesApi.deleteRule(context, token),
    onSuccess: (message) => {
      toast.success(message);
      setDeleting(null);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error, 'Не удалось удалить правило')),
  });
  const testMutation = useMutation({
    mutationFn: ({ token, id }: { token: string; id: number }) =>
      duplicatesApi.testRule(context, token, id),
    onSuccess: (message) => {
      toast.success(message);
      setTesting(null);
      setLeadId('');
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error, 'Не удалось запустить правило')),
  });

  return (
    <SectionCard
      title="Правила цифровой воронки"
      description="Автоматически ищите и объединяйте дубли при запуске сценария."
      actions={
        <Button size="sm" onClick={() => setEditor({ key: createId() })}>
          <Plus className="size-4" /> Создать правило
        </Button>
      }
    >
      {rulesQuery.isPending && <div className="h-48 animate-pulse rounded-lg bg-slate-100" />}
      {rulesQuery.isError && (
        <ErrorState title="Не удалось загрузить правила" onRetry={() => rulesQuery.refetch()} />
      )}
      {!rulesQuery.isPending && !rulesQuery.isError && rulesQuery.data?.length === 0 && (
        <EmptyState
          icon={ScrollText}
          title="Правил пока нет"
          description="Создайте первое правило для цифровой воронки."
          action={
            <Button onClick={() => setEditor({ key: createId() })}>Создать правило</Button>
          }
        />
      )}
      {!rulesQuery.isPending &&
        !rulesQuery.isError &&
        rulesQuery.data &&
        rulesQuery.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-160 text-left text-sm">
              <thead className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-3 py-3">Название</th>
                  <th className="px-3 py-3">Последняя проверка</th>
                  <th className="px-3 py-3">Запусков</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rulesQuery.data.map((rule) => (
                  <tr key={rule.token}>
                    <td className="px-3 py-3 font-semibold text-slate-900">
                      {rule.name || 'Без названия'}
                    </td>
                    <td className="px-3 py-3 text-slate-500">{rule.lastCheck ?? '—'}</td>
                    <td className="px-3 py-3 text-slate-500">{rule.countCheck}</td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setTesting(rule)}>
                          <Beaker className="size-4" /> Тест
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditor({ key: rule.token, rule })}
                        >
                          <Pencil className="size-4" /> Изменить
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-danger-600"
                          aria-label={`Удалить правило ${rule.name || 'Без названия'}`}
                          onClick={() => setDeleting(rule)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {editor && (
        <RuleEditor
          key={editor.key}
          open
          rule={editor.rule}
          resources={resources}
          pending={saveMutation.isPending}
          onClose={() => setEditor(null)}
          onSave={(settings, token) => saveMutation.mutate({ settings, token })}
        />
      )}
      <Modal
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Удалить правило?"
        description="Действие нельзя отменить."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Отмена
            </Button>
            <Button
              variant="danger"
              loading={deleteMutation.isPending}
              onClick={() => deleting && deleteMutation.mutate(deleting.token)}
            >
              Удалить
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Правило «{deleting?.name}» будет удалено.</p>
      </Modal>
      <Modal
        open={Boolean(testing)}
        onOpenChange={(open) => !open && setTesting(null)}
        title="Тестовый запуск правила"
        description="Укажите ID сделки amoCRM."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTesting(null)}>
              Отмена
            </Button>
            <Button
              loading={testMutation.isPending}
              disabled={!/^\d+$/.test(leadId) || Number(leadId) <= 0}
              onClick={() =>
                testing && testMutation.mutate({ token: testing.token, id: Number(leadId) })
              }
            >
              Запустить
            </Button>
          </>
        }
      >
        <Input
          label="ID сделки"
          inputMode="numeric"
          value={leadId}
          onChange={(event) => setLeadId(event.target.value.replace(/\D/g, ''))}
          error={
            leadId && (!/^\d+$/.test(leadId) || Number(leadId) <= 0)
              ? 'Введите положительный числовой ID'
              : undefined
          }
        />
      </Modal>
    </SectionCard>
  );
}
