import type { ActivityDirectory, ActivityPanelInput } from '@/api/activityControl';
import { Input, Switch } from '@/components/ui';
type Options = ActivityPanelInput['options'];
type Thresholds = Options['operators'][number]['thresholds'];
const defaults = (): Thresholds => ({
  dialingSeconds: 10,
  conversationSeconds: 30,
  exceedingSeconds: 180,
});
function ThresholdFields({
  value,
  change,
}: {
  value: Thresholds;
  change: (value: Thresholds) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Input
        type="number"
        min={0}
        max={86400}
        label="Дозвон, секунд"
        value={value.dialingSeconds}
        onChange={(e) => change({ ...value, dialingSeconds: Number(e.target.value) })}
      />
      <Input
        type="number"
        min={1}
        max={86400}
        label="Разговор, секунд"
        value={value.conversationSeconds}
        onChange={(e) => change({ ...value, conversationSeconds: Number(e.target.value) })}
      />
      <Input
        type="number"
        min={2}
        max={86400}
        label="Превышение, секунд"
        value={value.exceedingSeconds}
        onChange={(e) => change({ ...value, exceedingSeconds: Number(e.target.value) })}
      />
    </div>
  );
}
export function ActivityOptionsEditor({
  directory,
  employees,
  value,
  change,
}: {
  directory: ActivityDirectory;
  employees: number[];
  value: Options;
  change: (value: Options) => void;
}) {
  const groups = new Map(directory.users.map((user) => [user.groupId, user.groupName]));
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Планы и длительность звонков</h3>
      <p className="text-xs text-slate-500">
        Дозвон должен быть короче разговора, а разговор короче порога превышения.
      </p>
      {directory.users
        .filter((user) => employees.includes(user.id))
        .map((user) => {
          const operator = value.operators.find((item) => item.employeeId === user.id);
          const update = (next: Options['operators'][number]) =>
            change({
              ...value,
              operators: [...value.operators.filter((item) => item.employeeId !== user.id), next],
            });
          return (
            <fieldset key={user.id} className="space-y-3 rounded-lg border border-slate-200 p-3">
              <legend className="px-1 text-sm">{user.name}</legend>
              <Switch
                aria-label="Учитывать план звонков"
                label="Учитывать план звонков"
                checked={operator?.enabled ?? false}
                onCheckedChange={(enabled) =>
                  update(
                    operator
                      ? { ...operator, enabled }
                      : { employeeId: user.id, enabled, plan: 100, thresholds: defaults() },
                  )
                }
              />
              {operator && (
                <>
                  <Input
                    type="number"
                    label="План звонков"
                    min={1}
                    max={100000}
                    value={operator.plan}
                    onChange={(e) => update({ ...operator, plan: Number(e.target.value) })}
                  />
                  <ThresholdFields
                    value={operator.thresholds}
                    change={(thresholds) => update({ ...operator, thresholds })}
                  />
                </>
              )}
            </fieldset>
          );
        })}
      <h3 className="text-sm font-semibold">Пороги отделов</h3>
      {Array.from(groups, ([id, name]) => {
        const department = value.departments.find((item) => item.groupId === id);
        return (
          <fieldset key={id} className="space-y-3 rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-sm">{name || 'Без отдела'}</legend>
            <Switch
              aria-label="Собственные пороги"
              label="Собственные пороги"
              checked={!!department}
              onCheckedChange={(enabled) =>
                change({
                  ...value,
                  departments: enabled
                    ? [...value.departments, { groupId: id, thresholds: defaults() }]
                    : value.departments.filter((item) => item.groupId !== id),
                })
              }
            />
            {department && (
              <ThresholdFields
                value={department.thresholds}
                change={(thresholds) =>
                  change({
                    ...value,
                    departments: value.departments.map((item) =>
                      item.groupId === id ? { ...item, thresholds } : item,
                    ),
                  })
                }
              />
            )}
          </fieldset>
        );
      })}
    </div>
  );
}
