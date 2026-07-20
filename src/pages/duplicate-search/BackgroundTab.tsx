import { ExternalLink, Plus, Trash2, Users } from 'lucide-react';
import type {
  DuplicatePaidStatus,
  DuplicateResources,
  DuplicateSettings,
  UnionTarget,
} from '@/api/rakurs/duplicates';
import { Button, Select } from '@/components/ui';
import { FieldClausesEditor, SectionCard, Segmented, Toggle } from './controls';

export function BackgroundTab({
  settings,
  resources,
  paidStatus,
  onSettingsChange,
  onSave,
  saving,
}: {
  settings: DuplicateSettings;
  resources: DuplicateResources;
  paidStatus?: DuplicatePaidStatus;
  onSettingsChange: (settings: DuplicateSettings) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const selectedManagers = new Set(
    settings.manager.flatMap((item) => (item.manager ? [item.manager] : [])),
  );
  const limit = paidStatus?.countAvailableUsers ?? 0;
  const canAddManager = !paidStatus || settings.manager.length < limit;

  return (
    <div className="space-y-4">
      <SectionCard
        title="Проверка карточек"
        description="Настройте предотвращение дублей при работе сотрудников в amoCRM."
        actions={
          <a
            href="https://ssd.rkrs.ru/page/app/rkrs_duplicates_v2?section=3"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:text-primary-800"
          >
            Инструкция <ExternalLink className="size-3.5" />
          </a>
        }
      >
        <Toggle
          checked={settings.events}
          onCheckedChange={(events) => onSettingsChange({ ...settings, events })}
          label="Запретить создание дубля"
          description="При создании или изменении контакта и компании проверять телефон и email. Если найден дубль, сохранение карточки будет заблокировано."
        />
      </SectionCard>

      <SectionCard
        title="Пользователи фонового режима"
        description="Для каждого сотрудника можно отдельно выбрать способ автоматического объединения."
        actions={
          paidStatus ? (
            <div className="flex items-center gap-2 rounded-md bg-primary-50 px-3 py-2 text-sm text-primary-800">
              <Users className="size-4" /> Доступно: {paidStatus.countAvailableUsers}
            </div>
          ) : undefined
        }
      >
        <div className="space-y-3">
          {settings.manager.map((row, index) => (
            <div
              key={index}
              className="grid items-end gap-3 rounded-md border border-slate-100 bg-surface-sunken/50 p-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.55fr)_auto]"
            >
              <Select
                label="Сотрудник"
                value={row.manager ?? undefined}
                placeholder="Выберите сотрудника"
                onValueChange={(manager) =>
                  onSettingsChange({
                    ...settings,
                    manager: settings.manager.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, manager } : item,
                    ),
                  })
                }
                options={resources.managers.map((option) => ({
                  ...option,
                  disabled: selectedManagers.has(option.value) && option.value !== row.manager,
                }))}
              />
              <Select
                label="Автоматическая склейка"
                value={row.isUnion}
                onValueChange={(isUnion) =>
                  onSettingsChange({
                    ...settings,
                    manager: settings.manager.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, isUnion: isUnion as UnionTarget } : item,
                    ),
                  })
                }
                options={[
                  { value: 'not', label: 'Склейка отключена' },
                  { value: 'old', label: 'В старую карточку' },
                  { value: 'new', label: 'В новую карточку' },
                ]}
              />
              {settings.manager.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger-600"
                  aria-label="Удалить сотрудника"
                  onClick={() =>
                    onSettingsChange({
                      ...settings,
                      manager: settings.manager.filter((_, itemIndex) => itemIndex !== index),
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              disabled={!canAddManager}
              onClick={() =>
                onSettingsChange({
                  ...settings,
                  manager: [...settings.manager, { manager: null, isUnion: 'not' }],
                })
              }
            >
              <Plus className="size-4" /> Добавить сотрудника
            </Button>
            {!canAddManager && (
              <span className="text-xs text-danger-600">
                Достигнут оплаченный лимит сотрудников.
              </span>
            )}
            <a
              href="https://wa.me/79214377886"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-primary-700 hover:text-primary-800"
            >
              Увеличить лимит
            </a>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Параметры поиска и склейки"
        description="Группы полей проверяются последовательно; внутри каждой группы действует выбранное условие И/ИЛИ."
      >
        <FieldClausesEditor
          clauses={settings.fields}
          options={resources.backgroundFields}
          onChange={(fields) => onSettingsChange({ ...settings, fields })}
        />
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          <span className="text-sm font-semibold text-slate-700">
            Информационный блок в карточке:
          </span>
          <Segmented
            value={settings.background_search}
            onChange={(background_search) => onSettingsChange({ ...settings, background_search })}
            ariaLabel="Расположение информационного блока"
            options={[
              { value: 'left', label: 'Слева' },
              { value: 'right', label: 'Справа' },
            ]}
          />
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <Button loading={saving} onClick={onSave}>
          Сохранить фоновый режим
        </Button>
      </div>
    </div>
  );
}
